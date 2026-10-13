"""
Anomaly detection for time series metrics using statistical methods.
Detects outliers using Z-score and IQR methods, and identifies trend changes.
"""

from typing import Any
import numpy as np


class AnomalyDetector:
    """
    Detects anomalies in time series data using statistical methods.

    Methods:
    - detect: Find outliers using Z-score and IQR
    - detect_trend_change: Identify sudden changes in trends
    """

    def __init__(self):
        """
        Initialize the anomaly detector.

        Sets up statistical methods for detecting outliers and trend
        changes in time series data.
        """
        self.last_stats: dict[str, Any] = {}

    def detect(
        self,
        values: list[float],
        timestamps: list[int],
        sensitivity: float = 2.0
    ) -> dict[str, Any]:
        """
        Detect anomalies in time series data using Z-score and IQR methods.

        Args:
            values: List of numeric values
            timestamps: List of Unix timestamps corresponding to values
            sensitivity: Multiplier for threshold (higher = less sensitive). Default 2.0

        Returns:
            dict with keys:
                - anomalies: List of dicts {index, value, timestamp, score, method}
                - stats: Dict of {mean, std, median, q1, q3, iqr}
                - threshold: Dict with zscore_threshold and iqr_bounds
        """
        if not values or len(values) < 3:
            return {
                'anomalies': [],
                'stats': {},
                'threshold': {}
            }

        values_arr = np.array(values, dtype=float)

        # Calculate statistics
        mean = float(np.mean(values_arr))
        std = float(np.std(values_arr))
        median = float(np.median(values_arr))
        q1 = float(np.percentile(values_arr, 25))
        q3 = float(np.percentile(values_arr, 75))
        iqr = q3 - q1

        stats = {
            'mean': mean,
            'std': std,
            'median': median,
            'q1': q1,
            'q3': q3,
            'iqr': iqr,
            'min': float(np.min(values_arr)),
            'max': float(np.max(values_arr)),
            'count': len(values)
        }

        anomalies = []

        # Z-score method
        if std > 0:
            z_scores = np.abs((values_arr - mean) / std)
            z_threshold = sensitivity

            for idx, z_score in enumerate(z_scores):
                if z_score > z_threshold:
                    anomalies.append({
                        'index': int(idx),
                        'value': float(values[idx]),
                        'timestamp': int(timestamps[idx]),
                        'score': float(z_score),
                        'method': 'zscore'
                    })

        # IQR method
        if iqr > 0:
            lower_bound = q1 - 1.5 * iqr * (sensitivity / 2.0)
            upper_bound = q3 + 1.5 * iqr * (sensitivity / 2.0)

            for idx, val in enumerate(values_arr):
                if val < lower_bound or val > upper_bound:
                    # Check if not already detected by Z-score
                    if not any(a['index'] == idx and a['method'] == 'zscore' for a in anomalies):
                        score = max(
                            abs(val - upper_bound) / (iqr + 1e-6),
                            abs(val - lower_bound) / (iqr + 1e-6)
                        )
                        anomalies.append({
                            'index': int(idx),
                            'value': float(val),
                            'timestamp': int(timestamps[idx]),
                            'score': float(score),
                            'method': 'iqr'
                        })

        # Sort by timestamp
        anomalies.sort(key=lambda x: x['timestamp'])

        threshold = {
            'zscore_threshold': float(sensitivity),
            'iqr_lower': float(q1 - 1.5 * iqr * (sensitivity / 2.0)) if iqr > 0 else None,
            'iqr_upper': float(q3 + 1.5 * iqr * (sensitivity / 2.0)) if iqr > 0 else None
        }

        self.last_stats = stats

        return {
            'anomalies': anomalies,
            'stats': stats,
            'threshold': threshold
        }

    def detect_trend_change(self, values: list[float]) -> dict[str, Any]:
        """
        Detect sudden changes in trend using rolling window comparison.

        Args:
            values: List of numeric values in time order

        Returns:
            dict with keys:
                - trend_changes: List of dicts {index, magnitude, direction, confidence}
                - overall_trend: 'upward', 'downward', or 'stable'
                - volatility: Standard deviation of differences
        """
        if len(values) < 6:
            return {
                'trend_changes': [],
                'overall_trend': 'stable',
                'volatility': 0.0
            }

        values_arr = np.array(values, dtype=float)

        # Calculate differences (deltas)
        diffs = np.diff(values_arr)

        # Window size for trend comparison
        window_size = max(3, len(values) // 4)

        trend_changes = []

        for i in range(window_size, len(diffs)):
            prev_trend = np.mean(diffs[i - window_size:i])
            curr_trend = np.mean(diffs[i:min(i + window_size, len(diffs))])

            # Detect significant changes
            change_magnitude = abs(curr_trend - prev_trend)

            # Avoid division by zero
            volatility_std = np.std(diffs) if len(diffs) > 0 else 0.0001
            if volatility_std == 0:
                volatility_std = 0.0001

            change_score = change_magnitude / volatility_std

            if change_score > 2.0:  # Significant change threshold
                direction = 'upward' if curr_trend > prev_trend else 'downward'
                confidence = min(1.0, change_score / 5.0)

                trend_changes.append({
                    'index': int(i),
                    'magnitude': float(change_magnitude),
                    'direction': direction,
                    'confidence': float(confidence)
                })

        # Determine overall trend
        if len(diffs) > 0:
            overall_mean = np.mean(diffs)
            if overall_mean > 0:
                overall_trend = 'upward'
            elif overall_mean < 0:
                overall_trend = 'downward'
            else:
                overall_trend = 'stable'
        else:
            overall_trend = 'stable'

        volatility = float(np.std(diffs)) if len(diffs) > 0 else 0.0

        return {
            'trend_changes': trend_changes,
            'overall_trend': overall_trend,
            'volatility': volatility,
            'trend_magnitude': float(np.mean(diffs)) if len(diffs) > 0 else 0.0
        }
