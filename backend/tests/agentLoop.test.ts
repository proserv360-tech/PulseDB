/**
 * tests/agentLoop.test.ts — autonomous agent loop unit tests.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateSeries, runAgentSweep } from '../services/agentLoopService.js';

test('evaluateSeries returns null on stable series', () => {
    const stable = Array.from({ length: 60 }, () => 100 + Math.sin(Math.random()) * 2);
    assert.equal(evaluateSeries('t:stable', stable), null);
});

test('evaluateSeries flags a large spike at the end', () => {
    const values = Array.from({ length: 60 }, () => 100 + (Math.random() - 0.5));
    values.push(100 * 10); // 10x spike
    const hit = evaluateSeries('t:spike', values);
    assert.ok(hit, 'expected a finding');
    assert.equal(hit!.metric, 't:spike');
    assert.ok(hit!.deviation > 3, `deviation ${hit!.deviation} should exceed threshold`);
});

test('evaluateSeries returns null when there is not enough history', () => {
    assert.equal(evaluateSeries('t:short', [1, 2, 3]), null);
});

test('runAgentSweep skips quietly without enough snapshots', async () => {
    const fakePool = { query: async () => ({ rows: [] }) };
    const out = await runAgentSweep({ pool: fakePool });
    assert.deepEqual(out.findings, []);
    assert.ok(out.skipped);
});

test('runAgentSweep writes a finding and an alert on anomaly', async () => {
    const buckets: any[] = [];
    const now = Date.now();
    for (let i = 0; i < 96; i++) {
        // newest first, like the real query (ORDER BY time_bucket DESC)
        const spike = i === 0; // newest row spikes
        buckets.push({
            time_bucket: new Date(now - i * 60000),
            avg_qps: spike ? 5000 : 100 + (Math.random() - 0.5),
            avg_tps: 50,
            avg_latency_p95_ms: 12,
            avg_latency_p99_ms: 30,
        });
    }
    const executed: string[] = [];
    const fakePool = {
        query: async (sql: string, params?: any[]) => {
            executed.push(sql.trim().split(/\s+/).slice(0, 3).join(' '));
            if (sql.includes('FROM fathom_metric_snapshots')) return { rows: buckets };
            if (sql.includes('SELECT id FROM fathom_agent_findings')) return { rows: [] };
            if (sql.includes('INSERT INTO fathom_agent_findings'))
                return { rows: [{ id: 1, detected_at: new Date() }] };
            if (sql.includes('INSERT INTO fathom_alerts')) return { rows: [] };
            return { rows: [] };
        },
    };
    const out = await runAgentSweep({ pool: fakePool });
    assert.ok(out.findings.length >= 1, 'expected at least one finding');
    assert.equal(out.findings[0].metric, 'qps');
    assert.ok(executed.some((q) => q.startsWith('INSERT INTO fathom_agent_findings')));
    assert.ok(executed.some((q) => q.startsWith('INSERT INTO fathom_alerts')));
});
