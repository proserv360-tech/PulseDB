/**
 * tests/anomaly.test.js
 * ──────────────────────
 * Unit tests for the anomaly detectors and evaluator.
 *
 * Run: node --test tests/anomaly.test.js
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { RollingZScoreDetector } from '../services/anomaly/rollingZScore.js';
import { EwmaDetector } from '../services/anomaly/ewma.js';
import { MadDetector } from '../services/anomaly/mad.js';
import {
    createDetector,
    AnomalyEvaluator,
    DETECTOR_TYPES,
    ANOMALY_MODES,
} from '../services/anomaly/detectorRegistry.js';

// Helpers
const feed = (det, values) => values.map((v) => det.push(v));
const lastAnomaly = (results) => results[results.length - 1].anomaly;

// ── Rolling z-score ───────────────────────────────────────────────────────
describe('RollingZScoreDetector', () => {
    it('does not flag during warmup', () => {
        const det = new RollingZScoreDetector({ window: 30, threshold: 3, warmup: 10 });
        const results = feed(det, [1, 1, 1, 1, 1, 1, 1, 1, 1]); // 9 pts, warmup=10
        assert.ok(results.every((r) => !r.anomaly));
        assert.ok(results.every((r) => r.score === 0));
    });

    it('flags a large spike after a stable baseline', () => {
        const det = new RollingZScoreDetector({ window: 30, threshold: 3, warmup: 10 });
        // 30 samples of noise around 100
        for (let i = 0; i < 30; i++) det.push(100 + Math.sin(i) * 0.1);
        const r = det.push(200); // huge spike
        assert.equal(r.anomaly, true);
        assert.ok(r.score >= 3);
    });

    it('does not flag a tiny deviation from a noisy baseline', () => {
        const det = new RollingZScoreDetector({ window: 30, threshold: 3, warmup: 10 });
        for (let i = 0; i < 30; i++) det.push(100 + (i % 5) - 2); // spread ~4
        const r = det.push(101);
        assert.equal(r.anomaly, false);
    });

    it('degenerate constant series: flags any differing value', () => {
        const det = new RollingZScoreDetector({ window: 30, threshold: 3, warmup: 10 });
        for (let i = 0; i < 30; i++) det.push(42);
        assert.equal(det.push(42).anomaly, false); // match → not anomaly
        assert.equal(det.push(43).anomaly, true);  // differ → anomaly
    });

    it('rejects non-finite input gracefully', () => {
        const det = new RollingZScoreDetector({ window: 30, threshold: 3, warmup: 10 });
        const r = det.push(NaN);
        assert.equal(r.anomaly, false);
        assert.match(r.reason, /non-finite/);
    });

    it('reset() clears state', () => {
        const det = new RollingZScoreDetector({ window: 30, threshold: 3, warmup: 10 });
        for (let i = 0; i < 20; i++) det.push(5);
        det.reset();
        assert.equal(det.filled, 0);
        assert.equal(det.mean, 0);
    });
});

// ── EWMA ──────────────────────────────────────────────────────────────────
describe('EwmaDetector', () => {
    it('first sample is never an anomaly', () => {
        const det = new EwmaDetector({ alpha: 0.1, threshold: 3, warmup: 10 });
        const r = det.push(100);
        assert.equal(r.anomaly, false);
    });

    it('flags a sudden spike once past warmup', () => {
        const det = new EwmaDetector({ alpha: 0.1, threshold: 3, warmup: 10 });
        for (let i = 0; i < 20; i++) det.push(10 + Math.cos(i) * 0.05);
        const r = det.push(50);
        assert.equal(r.anomaly, true);
    });

    it('does not flag gradual drift', () => {
        const det = new EwmaDetector({ alpha: 0.2, threshold: 3, warmup: 10 });
        // Gentle ramp; alpha=0.2 tracks it. Also check no large final flag.
        const results = [];
        for (let i = 0; i < 60; i++) results.push(det.push(10 + i * 0.05));
        // A few borderline flags may occur early; the final half should be clean.
        const tail = results.slice(30);
        const flags = tail.filter((r) => r.anomaly).length;
        assert.ok(flags <= 1, `expected ≤1 late-stage flag, got ${flags}`);
    });

    it('rejects invalid alpha', () => {
        assert.throws(() => new EwmaDetector({ alpha: 0 }), /alpha/);
        assert.throws(() => new EwmaDetector({ alpha: 1.5 }), /alpha/);
    });

    it('handles non-finite input', () => {
        const det = new EwmaDetector({ alpha: 0.1, threshold: 3, warmup: 10 });
        for (let i = 0; i < 15; i++) det.push(1);
        const r = det.push(Infinity);
        assert.equal(r.anomaly, false);
    });
});

// ── MAD ───────────────────────────────────────────────────────────────────
describe('MadDetector', () => {
    it('flags an outlier against a bounded baseline', () => {
        const det = new MadDetector({ window: 30, threshold: 3.5, warmup: 10 });
        for (let i = 0; i < 30; i++) det.push(50 + (i % 3));
        const r = det.push(500);
        assert.equal(r.anomaly, true);
    });

    it('remains quiet on a noisy baseline', () => {
        const det = new MadDetector({ window: 30, threshold: 3.5, warmup: 10 });
        for (let i = 0; i < 30; i++) det.push(50 + ((i * 7) % 11));
        const r = det.push(52);
        assert.equal(r.anomaly, false);
    });

    it('does not flag when MAD=0 (insufficient spread)', () => {
        const det = new MadDetector({ window: 30, threshold: 3.5, warmup: 10 });
        for (let i = 0; i < 30; i++) det.push(42);
        const r = det.push(1000);
        assert.equal(r.anomaly, false);
        assert.equal(r.mad, 0);
        assert.equal(r.reason, 'MAD=0');
    });

    it('shrugs off a single contaminating spike on later samples', () => {
        const det = new MadDetector({ window: 30, threshold: 3.5, warmup: 10 });
        // Inject one huge spike amid an otherwise stable signal
        for (let i = 0; i < 20; i++) det.push(10);
        det.push(10_000); // single spike
        // After the spike, feed normal values — they should not be flagged.
        for (let i = 0; i < 5; i++) det.push(10);
        const r = det.push(11);
        assert.equal(r.anomaly, false);
    });
});

// ── createDetector / AnomalyEvaluator ─────────────────────────────────────
describe('createDetector', () => {
    it('builds each registered type', () => {
        assert.ok(createDetector('zscore') instanceof RollingZScoreDetector);
        assert.ok(createDetector('rolling-zscore') instanceof RollingZScoreDetector);
        assert.ok(createDetector('ewma') instanceof EwmaDetector);
        assert.ok(createDetector('mad') instanceof MadDetector);
    });

    it('rejects unknown types with an informative error', () => {
        assert.throws(() => createDetector('arima'), /Unknown detector type/);
    });

    it('DETECTOR_TYPES lists each creator', () => {
        for (const t of DETECTOR_TYPES) {
            assert.doesNotThrow(() => createDetector(t));
        }
    });
});

describe('AnomalyEvaluator', () => {
    it('caches one detector per (metric, rule) key', () => {
        const ev = new AnomalyEvaluator();
        const rule = { type: 'zscore', window: 20, threshold: 3 };
        for (let i = 0; i < 15; i++) ev.evaluate('db.x', 10, rule);
        for (let i = 0; i < 15; i++) ev.evaluate('db.x', 10, rule);
        assert.equal(ev.size(), 1);
    });

    it('creates a fresh detector when configuration changes', () => {
        const ev = new AnomalyEvaluator();
        ev.evaluate('db.x', 1, { type: 'zscore', window: 30 });
        ev.evaluate('db.x', 1, { type: 'zscore', window: 60 });
        assert.equal(ev.size(), 2);
    });

    it('mode=off skips evaluation entirely', () => {
        const ev = new AnomalyEvaluator();
        const r = ev.evaluate('db.x', 999, { type: 'zscore', mode: 'off' });
        assert.equal(r.anomaly, false);
        assert.equal(r.firing, false);
        assert.equal(r.suggested, false);
        assert.equal(ev.size(), 0); // off does not even instantiate a detector
    });

    it('mode=suggest marks anomalies as suggested but not firing', () => {
        const ev = new AnomalyEvaluator();
        const rule = { type: 'zscore', window: 20, threshold: 3, mode: 'suggest' };
        for (let i = 0; i < 20; i++) ev.evaluate('db.x', 5, rule);
        const r = ev.evaluate('db.x', 500, rule);
        assert.equal(r.anomaly, true);
        assert.equal(r.suggested, true);
        assert.equal(r.firing, false);
    });

    it('mode=page marks anomalies as firing', () => {
        const ev = new AnomalyEvaluator();
        const rule = { type: 'zscore', window: 20, threshold: 3, mode: 'page' };
        for (let i = 0; i < 20; i++) ev.evaluate('db.x', 5, rule);
        const r = ev.evaluate('db.x', 500, rule);
        assert.equal(r.firing, true);
        assert.equal(r.suggested, false);
    });

    it('ANOMALY_MODES lists off/suggest/page', () => {
        assert.deepEqual(ANOMALY_MODES, ['off', 'suggest', 'page']);
    });

    it('drop(metric, rule) removes the cached detector', () => {
        const ev = new AnomalyEvaluator();
        const rule = { type: 'zscore', window: 30 };
        ev.evaluate('db.x', 1, rule);
        assert.equal(ev.size(), 1);
        ev.drop('db.x', rule);
        assert.equal(ev.size(), 0);
    });
});
