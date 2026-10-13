#!/usr/bin/env node
/**
 * alert-load.js
 * ─────────────
 * Measures how many DSL alert rules the evaluator can execute per
 * core-second against a synthetic metrics provider. Pure CPU benchmark,
 * no network — establishes the floor for the alert loop.
 */
import { performance } from 'node:perf_hooks';
import { parse, evaluate } from '../../backend/services/alertDsl.js';

const RULES = [
    'cpu_pct > 90',
    'avg(cpu_pct, 300) >= 80',
    'pct_change(qps, 600) > 0.5 && qps > 100',
    'sustained(replica_lag_ms, \'>\', 5000, 300)',
    'connection_count > 0.8 * max_connections',
    'rate(bytes_in, 60) > 1000000',
];

const asts = RULES.map(parse);
const mp = {
    current: (_) => 75 + Math.random() * 30,
    series: (_n, win) => Array.from({ length: Math.min(60, win) },
        (_, i) => ({ t: i, v: 70 + Math.random() * 25 })),
};

const iters = 200_000;
const start = performance.now();
for (let i = 0; i < iters; i++) {
    for (const ast of asts) evaluate(ast, mp);
}
const ms = performance.now() - start;
const totalEvals = iters * asts.length;

console.log(JSON.stringify({
    rules: RULES.length,
    iterations: iters,
    totalEvaluations: totalEvals,
    durationMs: Math.round(ms),
    evalsPerSecond: Math.round(totalEvals / (ms / 1000)),
}, null, 2));
