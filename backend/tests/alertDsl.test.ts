/**
 * alertDsl.test.js — Node built-in test runner.
 * Run with:
 *   node --test backend/tests/alertDsl.test.js
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { parse, evaluate, validate } from '../services/alertDsl.js';

// Fake metrics provider — returns deterministic values for tests.
function mkProvider({ current = {}, series = {} } = {}) {
    return {
        current: (name) => {
            if (!(name in current)) throw new Error(`unknown metric ${name}`);
            return current[name];
        },
        series: (name, _win) => series[name] || [],
    };
}

test('parses a simple comparison', () => {
    const ast = parse('cpu_pct > 90');
    assert.equal(ast.type, 'cmp');
    assert.equal(ast.op, '>');
});

test('validate catches syntax errors', () => {
    assert.deepEqual(validate('cpu_pct >').ok, false);
    assert.deepEqual(validate('cpu_pct > 90').ok, true);
});

test('evaluates threshold', () => {
    const ast = parse('cpu_pct > 90');
    const mp = mkProvider({ current: { cpu_pct: 93 } });
    assert.equal(evaluate(ast, mp), true);
});

test('evaluates composite AND', () => {
    const ast = parse('cpu_pct > 80 && mem_pct > 70');
    const mp = mkProvider({ current: { cpu_pct: 85, mem_pct: 65 } });
    assert.equal(evaluate(ast, mp), false);
});

test('evaluates composite OR', () => {
    const ast = parse('cpu_pct > 99 || replica_lag_ms > 5000');
    const mp = mkProvider({ current: { cpu_pct: 20, replica_lag_ms: 6000 } });
    assert.equal(evaluate(ast, mp), true);
});

test('avg() function', () => {
    const ast = parse('avg(cpu_pct, 300) > 75');
    const mp = mkProvider({
        series: { cpu_pct: [{ t: 1, v: 60 }, { t: 2, v: 80 }, { t: 3, v: 90 }] },
    });
    assert.equal(evaluate(ast, mp), true); // avg = 76.67
});

test('rate() function', () => {
    const ast = parse('rate(bytes_in, 60) > 1000');
    const mp = mkProvider({
        series: { bytes_in: [{ t: 0, v: 0 }, { t: 60, v: 120000 }] },
    });
    assert.equal(evaluate(ast, mp), true); // (120000 - 0) / 60 = 2000
});

test('pct_change() function', () => {
    const ast = parse('pct_change(qps, 600) > 0.5');
    const mp = mkProvider({
        series: { qps: [{ t: 0, v: 100 }, { t: 600, v: 160 }] },
    });
    assert.equal(evaluate(ast, mp), true); // 60%
});

test('sustained() function', () => {
    const ast = parse("sustained(cpu_pct, '>', 85, 300)");
    const mp = mkProvider({
        series: { cpu_pct: [{ t: 1, v: 86 }, { t: 2, v: 90 }, { t: 3, v: 88 }] },
    });
    assert.equal(evaluate(ast, mp), true);
    const mp2 = mkProvider({
        series: { cpu_pct: [{ t: 1, v: 86 }, { t: 2, v: 70 }, { t: 3, v: 88 }] },
    });
    assert.equal(evaluate(ast, mp2), false);
});

test('arithmetic in thresholds', () => {
    const ast = parse('connection_count > 0.8 * max_connections');
    const mp = mkProvider({ current: { connection_count: 85, max_connections: 100 } });
    assert.equal(evaluate(ast, mp), true);
});

// ---------------------------------------------------------------------------
// Anomaly-detection integration (anomaly() / is_anomaly()).
// These wire the EWMA detector into the DSL so rules can reason about
// statistical anomalies, not just static thresholds.
// ---------------------------------------------------------------------------
function mkSeriesProvider(points) {
    return {
        current: () => points[points.length - 1].v,
        series: () => points,
    };
}

// Flat baseline (~100) of 50 samples, optionally followed by a spike.
const _flat = Array.from({ length: 50 }, (_, i) => ({ t: i, v: 100 + (i % 3 === 0 ? 1 : -1) }));
const _spike = [..._flat, { t: 50, v: 400 }];
const _calm = [..._flat, { t: 50, v: 101 }];

test('validate accepts anomaly() and is_anomaly()', () => {
    assert.equal(validate('anomaly(cpu_pct, 600) > 3').ok, true);
    assert.equal(validate('is_anomaly(cpu_pct, 600)').ok, true);
});

test('is_anomaly fires on a spike and stays quiet when calm', () => {
    const ast = parse('is_anomaly(cpu_pct, 600)');
    assert.equal(evaluate(ast, mkSeriesProvider(_spike)), true);
    assert.equal(evaluate(ast, mkSeriesProvider(_calm)), false);
});

test('anomaly() returns a numeric score, higher on a spike', () => {
    const ast = parse('anomaly(cpu_pct, 600)');
    const spikeScore = evaluate(ast, mkSeriesProvider(_spike));
    const calmScore = evaluate(ast, mkSeriesProvider(_calm));
    assert.equal(typeof spikeScore, 'number');
    assert.ok(spikeScore > calmScore);
    assert.ok(spikeScore >= 3);
});

test('anomaly functions compose with raw thresholds', () => {
    const ast = parse('is_anomaly(cpu_pct, 600) && cpu_pct > 200');
    assert.equal(evaluate(ast, mkSeriesProvider(_spike)), true);
    assert.equal(evaluate(ast, mkSeriesProvider(_calm)), false);
});

test('anomaly functions are safe on an empty series', () => {
    const empty = { current: () => 0, series: () => [] };
    assert.equal(evaluate(parse('is_anomaly(cpu_pct, 600)'), empty), false);
    assert.equal(evaluate(parse('anomaly(cpu_pct, 600)'), empty), 0);
});

test('anomaly() accepts an optional threshold argument', () => {
    const ast = parse('anomaly(cpu_pct, 600, 2)');
    assert.equal(typeof evaluate(ast, mkSeriesProvider(_spike)), 'number');
});
