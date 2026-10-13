// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)
/**
 * ewma.js
 * ────────
 * Exponentially-weighted moving average / variance detector.
 *
 * Recurrences (Hunter 1986; standard EWMA control chart):
 *   μ_t  = α · x_t + (1 − α) · μ_{t−1}
 *   σ²_t = α · (x_t − μ_{t−1})² + (1 − α) · σ²_{t−1}
 *
 * An anomaly fires when |x_t − μ_{t−1}| ≥ k · σ_{t−1}, with k = `threshold`.
 *
 * Why EWMA: O(1) memory per detector (two scalars), good for dense-metric
 * workloads where a rolling window would blow memory. Recent points weigh
 * more, which adapts faster to regime shifts than a fixed-window z-score
 * — at the cost of slightly weaker rejection of sudden one-off spikes.
 *
 * Rule of thumb:
 *   α = 0.05 → effective window ≈ 40 points (slow, smooth)
 *   α = 0.20 → effective window ≈ 10 points (fast, reactive)
 */

const DEFAULT_ALPHA = 0.1;
const DEFAULT_THRESHOLD = 3.0;
const DEFAULT_WARMUP = 10;

export class EwmaDetector {
    /**
     * @param {object} opts
     * @param {number} [opts.alpha=0.1]     — smoothing factor in (0, 1]
     * @param {number} [opts.threshold=3.0] — k in the k-sigma test
     * @param {number} [opts.warmup=10]     — minimum samples before scoring
     */
    constructor({ alpha = DEFAULT_ALPHA, threshold = DEFAULT_THRESHOLD, warmup = DEFAULT_WARMUP } = {}) {
        if (!(alpha > 0 && alpha <= 1)) throw new Error('EwmaDetector: alpha must be in (0, 1]');
        if (warmup < 2) throw new Error('EwmaDetector: warmup must be ≥ 2');
        this.alpha = alpha;
        this.threshold = threshold;
        this.warmup = warmup;
        this.count = 0;
        this.mean = 0;
        this.variance = 0;
    }

    reset() {
        this.count = 0;
        this.mean = 0;
        this.variance = 0;
    }

    push(x) {
        const value = Number(x);
        if (!Number.isFinite(value)) {
            return { anomaly: false, score: 0, mean: this.mean, stdev: 0, reason: 'non-finite input' };
        }

        if (this.count === 0) {
            this.mean = value;
            this.variance = 0;
            this.count = 1;
            return { anomaly: false, score: 0, mean: this.mean, stdev: 0, reason: 'first sample' };
        }

        const prevMean = this.mean;
        const prevVar = this.variance;
        const diff = value - prevMean;

        // Update using previous stats so the score reflects novelty of x_t.
        const stdev = Math.sqrt(prevVar);
        let score = 0;
        let anomaly = false;
        let reason;

        if (this.count < this.warmup) {
            reason = 'warmup';
        } else if (stdev === 0) {
            // All prior values identical. Any change fires at max score.
            anomaly = diff !== 0;
            score = anomaly ? this.threshold : 0;
        } else {
            score = Math.abs(diff) / stdev;
            anomaly = score >= this.threshold;
        }

        // Now advance the state.
        this.mean = this.alpha * value + (1 - this.alpha) * prevMean;
        this.variance = this.alpha * diff * diff + (1 - this.alpha) * prevVar;
        this.count += 1;

        return { anomaly, score, mean: prevMean, stdev, ...(reason && { reason }) };
    }
}

export default EwmaDetector;
