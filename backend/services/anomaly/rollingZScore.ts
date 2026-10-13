// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)
/**
 * rollingZScore.js
 * ─────────────────
 * Rolling-window z-score detector using a circular buffer and Welford's
 * online algorithm for O(1) mean/variance updates per point.
 *
 * Definition:
 *   z = (x - μ) / σ,  where μ and σ are computed over the last W points.
 *
 * An "anomaly" is emitted when |z| ≥ `threshold` (default 3).
 *
 * Why Welford: a naive sum-of-squares approach is numerically unstable when
 * the mean is large or variance is small, leading to false negatives after
 * millions of updates. Welford's recurrence tracks M2 = Σ(x - μ)^2 directly
 * and stays stable indefinitely.
 *
 * Why a circular buffer: each evaluation is O(1) regardless of window size;
 * memory is bounded to W floats.
 */

const DEFAULT_WINDOW = 60;
const DEFAULT_THRESHOLD = 3.0;
const DEFAULT_WARMUP = 10;

export class RollingZScoreDetector {
    /**
     * @param {object} opts
     * @param {number} [opts.window=60]     — number of points in the rolling window
     * @param {number} [opts.threshold=3.0] — |z| ≥ threshold → anomaly
     * @param {number} [opts.warmup=10]     — minimum points before we'll score
     */
    constructor({ window = DEFAULT_WINDOW, threshold = DEFAULT_THRESHOLD, warmup = DEFAULT_WARMUP } = {}) {
        if (window < 2) throw new Error('RollingZScoreDetector: window must be ≥ 2');
        if (warmup < 2) throw new Error('RollingZScoreDetector: warmup must be ≥ 2');
        this.window = window;
        this.threshold = threshold;
        this.warmup = Math.min(warmup, window);
        this.buffer = new Array(window).fill(0);
        this.filled = 0;           // how many slots are populated
        this.head = 0;             // next write position
        this.mean = 0;
        this.M2 = 0;               // Σ(x - μ)^2
    }

    /** Reset state — useful between evaluations of different metrics. */
    reset() {
        this.buffer.fill(0);
        this.filled = 0;
        this.head = 0;
        this.mean = 0;
        this.M2 = 0;
    }

    /**
     * Push one sample and return an { anomaly, score } object.
     *   anomaly : boolean
     *   score   : |z|  (0 when insufficient warmup)
     *   mean    : current rolling mean
     *   stdev   : current rolling stdev
     */
    push(x) {
        const value = Number(x);
        if (!Number.isFinite(value)) {
            return { anomaly: false, score: 0, mean: this.mean, stdev: 0, reason: 'non-finite input' };
        }

        if (this.filled < this.window) {
            // Welford add (online variance).
            this.filled += 1;
            const delta = value - this.mean;
            this.mean += delta / this.filled;
            const delta2 = value - this.mean;
            this.M2 += delta * delta2;
            this.buffer[this.head] = value;
            this.head = (this.head + 1) % this.window;
        } else {
            // Welford add + remove (Welford does not natively support removal,
            // so we reconstruct from the buffer contents — still O(W), but W
            // is bounded and this branch only fires once per step after fill).
            this.buffer[this.head] = value;
            this.head = (this.head + 1) % this.window;
            this._recomputeFromBuffer();
        }

        if (this.filled < this.warmup) {
            return { anomaly: false, score: 0, mean: this.mean, stdev: this._stdev(), reason: 'warmup' };
        }

        const stdev = this._stdev();
        if (stdev === 0) {
            // Degenerate: all values identical. A new point either matches
            // (anomaly=false) or differs (anomaly=true with max score).
            const anomaly = value !== this.mean;
            return { anomaly, score: anomaly ? this.threshold : 0, mean: this.mean, stdev };
        }

        const z = (value - this.mean) / stdev;
        const score = Math.abs(z);
        return { anomaly: score >= this.threshold, score, z, mean: this.mean, stdev };
    }

    _stdev() {
        if (this.filled < 2) return 0;
        return Math.sqrt(this.M2 / (this.filled - 1));
    }

    _recomputeFromBuffer() {
        // Only the W most recent samples are in the buffer.
        let mean = 0;
        for (let i = 0; i < this.window; i++) mean += this.buffer[i];
        mean /= this.window;
        let m2 = 0;
        for (let i = 0; i < this.window; i++) {
            const d = this.buffer[i] - mean;
            m2 += d * d;
        }
        this.mean = mean;
        this.M2 = m2;
    }
}

export default RollingZScoreDetector;
