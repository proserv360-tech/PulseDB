// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)
/**
 * mad.js
 * ───────
 * Median Absolute Deviation detector.
 *
 * Definition:
 *   MAD = median(|x_i − median(x)|)   over the rolling window
 *   modified z-score = 0.6745 · (x − median) / MAD
 *
 * The constant 0.6745 comes from Φ⁻¹(0.75) for a Normal distribution — it
 * makes the MAD a consistent estimator of σ under normality, so a modified
 * z-score threshold of 3.5 ≈ the classical z-score threshold of 3.
 *
 * Why MAD instead of (or alongside) z-score: MAD is robust to outliers.
 * A single huge spike contaminates a rolling mean/variance z-score for the
 * entire window duration. The median ignores it. In practice, MAD is the
 * safest first detector to ship to customers who see occasional large
 * events (deploys, backfills, cache warms).
 *
 * Degenerate case: MAD = 0 means at least half the points in the window
 * are identical to the median. In that situation the modified z-score
 * blows up (division by zero) and the detector would flag every differing
 * value at max score. We return 0 (anomaly=false) in that case, matching
 * the statistically-correct reading: "insufficient spread to decide."
 */

const DEFAULT_WINDOW = 60;
const DEFAULT_THRESHOLD = 3.5;
const DEFAULT_WARMUP = 10;
const MAD_SCALE = 0.6745;

function median(sortedAsc) {
    const n = sortedAsc.length;
    if (n === 0) return 0;
    const mid = Math.floor(n / 2);
    return (n % 2 === 1) ? sortedAsc[mid] : (sortedAsc[mid - 1] + sortedAsc[mid]) / 2;
}

export class MadDetector {
    /**
     * @param {object} opts
     * @param {number} [opts.window=60]     — number of points in the rolling window
     * @param {number} [opts.threshold=3.5] — modified-z threshold
     * @param {number} [opts.warmup=10]
     */
    constructor({ window = DEFAULT_WINDOW, threshold = DEFAULT_THRESHOLD, warmup = DEFAULT_WARMUP } = {}) {
        if (window < 4) throw new Error('MadDetector: window must be ≥ 4');
        if (warmup < 4) throw new Error('MadDetector: warmup must be ≥ 4');
        this.window = window;
        this.threshold = threshold;
        this.warmup = Math.min(warmup, window);
        this.buffer = [];
    }

    reset() {
        this.buffer = [];
    }

    push(x) {
        const value = Number(x);
        if (!Number.isFinite(value)) {
            return { anomaly: false, score: 0, median: null, mad: null, reason: 'non-finite input' };
        }

        this.buffer.push(value);
        if (this.buffer.length > this.window) this.buffer.shift();

        if (this.buffer.length < this.warmup) {
            return { anomaly: false, score: 0, median: null, mad: null, reason: 'warmup' };
        }

        const sorted = [...this.buffer].sort((a, b) => a - b);
        const med = median(sorted);
        const absDevs = this.buffer.map((v) => Math.abs(v - med)).sort((a, b) => a - b);
        const mad = median(absDevs);

        if (mad === 0) {
            // Degenerate: too little spread. Do not flag.
            return { anomaly: false, score: 0, median: med, mad, reason: 'MAD=0' };
        }

        const score = Math.abs(MAD_SCALE * (value - med) / mad);
        return { anomaly: score >= this.threshold, score, median: med, mad };
    }
}

export default MadDetector;
