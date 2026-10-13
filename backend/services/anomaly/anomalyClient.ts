// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)
/**
 * services/anomaly/anomalyClient.js
 * ─────────────────────────────────
 * Thin client that calls the FastAPI anomaly worker. Falls back to a
 * best-effort in-process rolling z-score when the Python worker isn't
 * reachable (so developers get signal locally without docker-compose).
 */

const ANALYTICS_URL =
    process.env.ANALYTICS_URL ||
    process.env.PYTHON_ANALYTICS_URL ||
    'http://localhost:8000';

export async function detectAnomalies({
    points,
    method = 'zscore',
    window = 60,
    threshold = 3.0,
}) {
    try {
        const r = await fetch(`${ANALYTICS_URL}/api/anomaly/detect`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ points, method, window, threshold }),
            signal: AbortSignal.timeout(5000),
        });
        if (!r.ok) throw new Error(`anomaly worker ${r.status}`);
        return await r.json();
    } catch (err) {
        console.warn('[anomaly] falling back to local detector:', err.message);
        return localZScore(points, window, threshold);
    }
}

function localZScore(points, window, threshold) {
    const values = points.map(p => p.v);
    const anomalies = [];
    for (let i = window; i < values.length; i++) {
        const slice = values.slice(i - window, i);
        const mean = slice.reduce((a, b) => a + b, 0) / slice.length;
        const variance = slice.reduce(
            (a, b) => a + (b - mean) ** 2, 0
        ) / Math.max(slice.length - 1, 1);
        const std = Math.sqrt(variance);
        if (std === 0) continue;
        const score = Math.abs(values[i] - mean) / std;
        if (score >= threshold) {
            anomalies.push({
                t: points[i].t,
                v: values[i],
                score,
                expected: mean,
                reason: `|x-µ|/σ = ${score.toFixed(2)}`,
            });
        }
    }
    return { method: 'zscore', count: anomalies.length, anomalies };
}
