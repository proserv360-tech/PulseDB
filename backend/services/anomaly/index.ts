/**
 * anomaly/index.js
 * ─────────────────
 * Barrel export for the anomaly-detection suite.
 */
export { RollingZScoreDetector } from './rollingZScore.js';
export { EwmaDetector } from './ewma.js';
export { MadDetector } from './mad.js';
export {
    createDetector,
    AnomalyEvaluator,
    anomalyEvaluator,
    DETECTOR_TYPES,
    ANOMALY_MODES,
} from './detectorRegistry.js';
