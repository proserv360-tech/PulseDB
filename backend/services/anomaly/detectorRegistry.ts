// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)
/**
 * detectorRegistry.js
 * ────────────────────
 * Factory + registry for anomaly detectors. alertService uses this to
 * construct and cache one detector instance per (metric, rule) pair.
 *
 * Ship in "suggest" mode by default: suggested anomalies are recorded for
 * review in the admin UI but do NOT automatically fire downstream pages.
 * Customers must explicitly set `mode: 'page'` on an anomaly rule before it
 * becomes a page source.
 *
 * Usage:
 *   import { createDetector, AnomalyEvaluator } from './detectorRegistry.js';
 *   const ev = new AnomalyEvaluator();
 *   const result = ev.evaluate('db.connections', 42, { type: 'zscore', window: 60 });
 */

import { RollingZScoreDetector } from './rollingZScore.js';
import { EwmaDetector } from './ewma.js';
import { MadDetector } from './mad.js';

export const DETECTOR_TYPES = ['zscore', 'ewma', 'mad'];
export const ANOMALY_MODES = ['off', 'suggest', 'page'];

export function createDetector(type, opts = {}) {
    switch (String(type).toLowerCase()) {
        case 'zscore':
        case 'rolling-zscore':
            return new RollingZScoreDetector(opts);
        case 'ewma':
            return new EwmaDetector(opts);
        case 'mad':
            return new MadDetector(opts);
        default:
            throw new Error(`Unknown detector type: ${type}. Allowed: ${DETECTOR_TYPES.join(', ')}`);
    }
}

/**
 * AnomalyEvaluator manages a set of named detectors and routes values to them.
 * Each (metricKey, detectorType, optHash) gets its own detector instance so
 * configuration changes create a fresh baseline rather than polluting history.
 */
export class AnomalyEvaluator {
    constructor() {
        this.detectors = new Map();
    }

    _key(metricKey, rule) {
        const mode = rule.mode || 'suggest';
        const type = rule.type || 'zscore';
        const window = rule.window || 60;
        const alpha = rule.alpha || 0.1;
        const threshold = rule.threshold;
        // Include every option that affects the detector so config changes
        // create a new instance.
        return `${metricKey}::${type}::${window}::${alpha}::${threshold ?? '-'}::${mode}`;
    }

    _getOrCreate(metricKey, rule) {
        const k = this._key(metricKey, rule);
        let det = this.detectors.get(k);
        if (!det) {
            const opts = {};
            if (rule.window !== undefined) opts.window = rule.window;
            if (rule.threshold !== undefined) opts.threshold = rule.threshold;
            if (rule.warmup !== undefined) opts.warmup = rule.warmup;
            if (rule.alpha !== undefined) opts.alpha = rule.alpha;
            det = createDetector(rule.type || 'zscore', opts);
            this.detectors.set(k, det);
        }
        return det;
    }

    /**
     * Push a sample and return a decision object.
     *
     * @param {string} metricKey    — e.g. "db.connections", "redis.ops_per_sec"
     * @param {number} value
     * @param {object} rule         — { type, window, threshold, warmup, alpha, mode }
     * @returns {{
     *   anomaly: boolean,
     *   suggested: boolean,        // true iff anomaly AND mode === 'suggest'
     *   firing: boolean,           // true iff anomaly AND mode === 'page'
     *   score: number,
     *   metricKey, detectorType, mode, raw
     * }}
     */
    evaluate(metricKey, value, rule = {}) {
        const mode = rule.mode || 'suggest';
        if (mode === 'off') {
            return { anomaly: false, suggested: false, firing: false, score: 0, metricKey, detectorType: rule.type || 'zscore', mode, raw: null };
        }
        const det = this._getOrCreate(metricKey, rule);
        const raw = det.push(value);
        const anomaly = !!raw.anomaly;
        return {
            anomaly,
            suggested: anomaly && mode === 'suggest',
            firing: anomaly && mode === 'page',
            score: raw.score,
            metricKey,
            detectorType: rule.type || 'zscore',
            mode,
            raw,
        };
    }

    /** Reset all detectors (useful after a config-wide change). */
    resetAll() {
        for (const det of this.detectors.values()) det.reset?.();
    }

    /** Drop a specific detector from the cache. */
    drop(metricKey, rule = {}) {
        this.detectors.delete(this._key(metricKey, rule));
    }

    /** Current number of live detectors. */
    size() {
        return this.detectors.size;
    }
}

/** Convenience singleton. alertService can import this directly. */
export const anomalyEvaluator = new AnomalyEvaluator();
