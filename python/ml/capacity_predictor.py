"""
Capacity prediction for database resources.
Predicts when connections, storage, and other resources will be exhausted.
"""

from typing import Any
import numpy as np
from datetime import datetime, timedelta


class CapacityPredictor:
    """
    Predicts resource exhaustion for database monitoring.

    Methods:
    - predict: Generic capacity prediction
    - predict_connections: Predict connection pool exhaustion
    - predict_storage: Predict storage exhaustion
    """

    def __init__(self):
        """
        Initialize the capacity predictor.

        Sets up the predictor for resource exhaustion forecasting.
        """
        self.predictions_cache: dict[str, dict[str, Any]] = {}

    def predict(
        self,
        current_usage: float,
        historical: list[dict[str, Any]],
        capacity: float
    ) -> dict[str, Any]:
        """
        Predict when resource capacity will be exhausted.

        Args:
            current_usage: Current resource usage (same units as historical)
            historical: List of dicts with {timestamp (unix), value (usage)}
            capacity: Maximum capacity (same units)

        Returns:
            dict with keys:
                - days_remaining: Estimated days until exhaustion (or None if stable)
                - projected_date: Datetime when capacity reached
                - growth_rate: Average growth per day
                - confidence: Confidence in prediction (0-1)
                - recommendation: String recommendation
        """
        if not historical or len(historical) < 2:
            return {
                'days_remaining': None,
                'projected_date': None,
                'growth_rate': 0.0,
                'confidence': 0.0,
                'recommendation': 'Insufficient data for prediction'
            }

        # Extract values and timestamps
        values = np.array([h.get('value') or h.get('connections') or 0.0 for h in historical], dtype=float)
        timestamps = np.array([h['timestamp'] for h in historical], dtype=float)

        # Sort by timestamp
        sort_idx = np.argsort(timestamps)
        values = values[sort_idx]
        timestamps = timestamps[sort_idx]

        # Calculate time deltas (in days)
        time_deltas = np.diff(timestamps) / 86400.0
        value_deltas = np.diff(values)

        if len(time_deltas) == 0:
            return {
                'days_remaining': None,
                'projected_date': None,
                'growth_rate': 0.0,
                'confidence': 0.0,
                'recommendation': 'Insufficient time span for prediction'
            }

        # Calculate average growth rate per day
        growth_rates = value_deltas / (time_deltas + 1e-6)
        avg_growth_rate = float(np.mean(growth_rates))
        growth_rate_std = float(np.std(growth_rates))

        # If negative/declining growth, no exhaustion expected
        if avg_growth_rate <= 0:
            return {
                'days_remaining': None,
                'projected_date': None,
                'growth_rate': avg_growth_rate,
                'confidence': 1.0,
                'recommendation': 'Resource usage is declining or stable'
            }

        # Calculate remaining capacity
        remaining = capacity - current_usage

        if remaining <= 0:
            return {
                'days_remaining': 0,
                'projected_date': datetime.now(),
                'growth_rate': avg_growth_rate,
                'confidence': 1.0,
                'recommendation': 'CRITICAL: Capacity already exceeded'
            }

        # Estimate days until exhaustion
        days_remaining = remaining / (avg_growth_rate + 1e-6)

        # Calculate confidence
        if growth_rate_std > 0:
            coefficient_variation = growth_rate_std / (abs(avg_growth_rate) + 1e-6)
            confidence = max(0.0, 1.0 - min(1.0, coefficient_variation))
        else:
            confidence = 0.95

        # Calculate projected date
        projected_date = datetime.now() + timedelta(days=days_remaining)

        # Generate recommendation
        if days_remaining < 7:
            recommendation = f'CRITICAL: Capacity exhaustion in {days_remaining:.1f} days'
        elif days_remaining < 30:
            recommendation = f'WARNING: Capacity exhaustion in {days_remaining:.1f} days - plan upgrade'
        elif days_remaining < 90:
            recommendation = f'CAUTION: Plan capacity expansion in {days_remaining:.1f} days'
        else:
            recommendation = 'Current growth trajectory manageable'

        return {
            'days_remaining': float(days_remaining),
            'projected_date': projected_date.isoformat(),
            'growth_rate': avg_growth_rate,
            'confidence': float(confidence),
            'recommendation': recommendation
        }

    def predict_connections(
        self,
        current: int,
        max_connections: int,
        history: list[dict[str, Any]]
    ) -> dict[str, Any]:
        """
        Predict when connection pool will be exhausted.

        Args:
            current: Current active connections
            max_connections: Maximum allowed connections
            history: List of dicts with {timestamp (unix), connections (int)}

        Returns:
            dict with keys:
                - days_remaining: Days until max connections
                - projected_date: When exhaustion occurs
                - current_connections: Current connection count
                - max_connections: Maximum limit
                - growth_rate: Connections per day
                - peak_connections: Historical peak
                - average_connections: Average from history
                - confidence: Prediction confidence
                - recommendation: Action recommendation
        """
        if not history or len(history) < 2:
            return {
                'days_remaining': None,
                'projected_date': None,
                'current_connections': current,
                'max_connections': max_connections,
                'growth_rate': 0.0,
                'peak_connections': current,
                'average_connections': float(current),
                'confidence': 0.0,
                'recommendation': 'Insufficient data for connection prediction'
            }

        # Call generic predictor
        prediction = self.predict(float(current), history, float(max_connections))

        # Extract additional metrics
        values = np.array([h.get('value') or h.get('connections') or 0.0 for h in history], dtype=float)
        peak = float(np.max(values))
        avg = float(np.mean(values))
        utilization = (current / max_connections * 100) if max_connections > 0 else 0

        # Enhance with connection-specific info
        result = {
            'days_remaining': prediction['days_remaining'],
            'projected_date': prediction['projected_date'],
            'current_connections': int(current),
            'max_connections': int(max_connections),
            'growth_rate': prediction['growth_rate'],
            'peak_connections': int(peak),
            'average_connections': avg,
            'confidence': prediction['confidence'],
            'utilization_percent': float(utilization),
            'recommendation': prediction['recommendation']
        }

        # Add connection-specific recommendation
        remaining_connections = max_connections - current
        if remaining_connections < 10:
            result['recommendation'] = 'CRITICAL: Connection pool nearly exhausted'
        elif remaining_connections < 50:
            result['recommendation'] = 'WARNING: Connection pool utilization high (>80%)'
        elif current > avg * 1.5:
            result['recommendation'] = 'Connection spike detected. Monitor for memory leaks.'

        return result

    def predict_storage(
        self,
        current_gb: float,
        max_gb: float,
        history: list[dict[str, Any]]
    ) -> dict[str, Any]:
        """
        Predict when storage capacity will be exhausted.

        Args:
            current_gb: Current storage usage in GB
            max_gb: Maximum storage capacity in GB
            history: List of dicts with {timestamp (unix), value (GB)}

        Returns:
            dict with keys:
                - days_remaining: Days until storage full
                - projected_date: When storage exhausted
                - current_usage_gb: Current usage
                - max_capacity_gb: Maximum capacity
                - growth_per_day_gb: Daily growth rate
                - utilization_percent: Current utilization %
                - recovery_needed_gb: GB needed to be freed to add X days
                - confidence: Prediction confidence
                - recommendation: Action items
        """
        if not history or len(history) < 2:
            utilization = (current_gb / max_gb * 100) if max_gb > 0 else 0
            return {
                'days_remaining': None,
                'projected_date': None,
                'current_usage_gb': current_gb,
                'max_capacity_gb': max_gb,
                'growth_per_day_gb': 0.0,
                'utilization_percent': utilization,
                'recovery_needed_gb': 0.0,
                'confidence': 0.0,
                'recommendation': 'Insufficient data for storage prediction'
            }

        # Call generic predictor
        prediction = self.predict(current_gb, history, max_gb)

        # Calculate utilization
        utilization = (current_gb / max_gb * 100) if max_gb > 0 else 0

        # Calculate recovery needed (to add 30 days)
        recovery_for_30_days = prediction['growth_rate'] * 30 if prediction['growth_rate'] > 0 else 0.0

        result = {
            'days_remaining': prediction['days_remaining'],
            'projected_date': prediction['projected_date'],
            'current_usage_gb': current_gb,
            'max_capacity_gb': max_gb,
            'growth_per_day_gb': prediction['growth_rate'],
            'utilization_percent': float(utilization),
            'recovery_needed_gb': float(recovery_for_30_days),
            'confidence': prediction['confidence'],
            'recommendation': prediction['recommendation']
        }

        # Add storage-specific recommendations
        if utilization > 90:
            result['recommendation'] = 'CRITICAL: Storage >90% full. Immediate action required.'
        elif utilization > 80:
            result['recommendation'] = 'WARNING: Storage >80% full. Plan expansion/cleanup.'
        elif utilization > 70:
            result['recommendation'] = f'Storage at {utilization:.1f}%. Monitor growth closely.'

        # Add archival suggestion
        if prediction['days_remaining'] and prediction['days_remaining'] < 30:
            result['recommendation'] += ' Consider archiving old data.'

        return result
