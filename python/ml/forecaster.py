"""
Time series forecasting for metrics using ensemble methods.
Combines linear regression, exponential smoothing, and moving averages.
"""

from typing import Any
import numpy as np


class MetricForecaster:
    """
    Forecasts future metric values using ensemble of simple methods.

    Methods:
    - forecast: Predict next N data points
    - detect_seasonality: Find periodic patterns in data
    """

    def __init__(self):
        """
        Initialize the forecaster.

        Sets up the metric forecasting engine with ensemble methods
        for time series prediction.
        """
        self.last_forecast: dict[str, Any] = {}

    def forecast(
        self,
        values: list[float],
        timestamps: list[int],
        horizon: int = 24
    ) -> dict[str, Any]:
        """
        Forecast next N data points using ensemble of methods.

        Args:
            values: Historical numeric values
            timestamps: Unix timestamps for each value
            horizon: Number of future points to forecast (default 24)

        Returns:
            dict with keys:
                - predictions: List of dicts {timestamp, value, lower_bound, upper_bound}
                - model_info: Dict with method weights and confidence scores
                - confidence: Overall confidence (0-1)
        """
        if not values or len(values) < 3:
            return {
                'predictions': [],
                'model_info': {},
                'confidence': 0.0
            }

        values_arr = np.array(values, dtype=float)
        timestamps_arr = np.array(timestamps, dtype=float)

        # Time interval between points (in seconds)
        if len(timestamps) > 1:
            time_interval = (timestamps[-1] - timestamps[0]) / (len(timestamps) - 1)
        else:
            time_interval = 3600.0  # Default 1 hour

        predictions = []

        # Method 1: Linear regression
        lr_pred, lr_std = self._linear_regression_forecast(
            values_arr, timestamps_arr, horizon, time_interval
        )

        # Method 2: Exponential smoothing
        exp_pred, exp_std = self._exponential_smoothing_forecast(
            values_arr, horizon
        )

        # Method 3: Simple moving average
        sma_pred, sma_std = self._moving_average_forecast(
            values_arr, horizon
        )

        # Ensemble: weighted average
        weights = [0.4, 0.35, 0.25]  # LR, Exp, SMA
        predictions_arr = np.array([lr_pred, exp_pred, sma_pred])
        std_arr = np.array([lr_std, exp_std, sma_std])

        ensemble_pred = np.average(predictions_arr, axis=0, weights=weights)
        ensemble_std = np.average(std_arr, axis=0, weights=weights)

        # Calculate confidence
        forecast_std = float(np.mean(ensemble_std))
        historical_std = float(np.std(values_arr))
        confidence = max(0.0, 1.0 - (forecast_std / (historical_std + 1e-6)))
        confidence = min(1.0, confidence)

        # Generate predictions with bounds
        for i in range(horizon):
            future_timestamp = timestamps[-1] + (i + 1) * int(time_interval)
            pred_value = float(ensemble_pred[i])
            pred_std = float(ensemble_std[i])

            predictions.append({
                'timestamp': future_timestamp,
                'value': pred_value,
                'lower_bound': pred_value - 1.96 * pred_std,  # 95% CI
                'upper_bound': pred_value + 1.96 * pred_std,
                'confidence': float(confidence)
            })

        model_info = {
            'linear_regression_weight': 0.4,
            'exponential_smoothing_weight': 0.35,
            'moving_average_weight': 0.25,
            'ensemble_method': 'weighted_average',
            'forecast_std': forecast_std,
            'historical_std': historical_std
        }

        self.last_forecast = {
            'predictions': predictions,
            'model_info': model_info,
            'confidence': confidence
        }

        return {
            'predictions': predictions,
            'model_info': model_info,
            'confidence': confidence
        }

    def _linear_regression_forecast(
        self,
        values: np.ndarray,
        timestamps: np.ndarray,
        horizon: int,
        time_interval: float
    ) -> tuple[np.ndarray, np.ndarray]:
        """Simple linear regression forecast."""
        # Normalize timestamps for fitting
        t = np.arange(len(values), dtype=float)

        # Fit line
        coeffs = np.polyfit(t, values, 1)
        slope, intercept = coeffs[0], coeffs[1]

        # Predict
        future_t = np.arange(len(values), len(values) + horizon, dtype=float)
        predictions = slope * future_t + intercept

        # Estimate uncertainty
        residuals = values - (slope * t + intercept)
        std_residuals = np.std(residuals)
        uncertainties = np.full(horizon, std_residuals)

        return predictions, uncertainties

    def _exponential_smoothing_forecast(
        self,
        values: np.ndarray,
        horizon: int
    ) -> tuple[np.ndarray, np.ndarray]:
        """Exponential smoothing forecast (simple exponential smoothing)."""
        alpha = 0.3  # Smoothing factor

        # Apply exponential smoothing
        smoothed = np.zeros_like(values)
        smoothed[0] = values[0]

        for i in range(1, len(values)):
            smoothed[i] = alpha * values[i] + (1 - alpha) * smoothed[i - 1]

        # Forecast (constant prediction)
        last_smoothed = smoothed[-1]
        predictions = np.full(horizon, last_smoothed, dtype=float)

        # Estimate uncertainty based on recent variance
        recent_window = max(3, len(values) // 4)
        recent_residuals = values[-recent_window:] - smoothed[-recent_window:]
        std_residuals = np.std(recent_residuals)

        # Uncertainty increases with horizon
        uncertainties = np.array([
            std_residuals * (1 + i * 0.1) for i in range(horizon)
        ])

        return predictions, uncertainties

    def _moving_average_forecast(
        self,
        values: np.ndarray,
        horizon: int
    ) -> tuple[np.ndarray, np.ndarray]:
        """Moving average forecast."""
        window_size = max(3, len(values) // 4)

        # Calculate moving average
        ma = np.convolve(values, np.ones(window_size) / window_size, mode='valid')

        # Use last MA value for forecast
        last_ma = ma[-1] if len(ma) > 0 else values[-1]
        predictions = np.full(horizon, last_ma, dtype=float)

        # Estimate uncertainty
        recent_window = max(3, len(values) // 4)
        recent_values = values[-recent_window:]
        std_recent = np.std(recent_values)

        uncertainties = np.full(horizon, std_recent)

        return predictions, uncertainties

    def detect_seasonality(self, values: list[float]) -> dict[str, Any]:
        """
        Detect periodic patterns in time series data.

        Args:
            values: Historical numeric values in time order

        Returns:
            dict with keys:
                - has_seasonality: Boolean
                - period: Detected period length (or None)
                - strength: Seasonality strength (0-1)
                - peaks: List of indices where peaks occur
        """
        if len(values) < 12:  # Need at least 12 points
            return {
                'has_seasonality': False,
                'period': None,
                'strength': 0.0,
                'peaks': []
            }

        values_arr = np.array(values, dtype=float)

        # Try common periods
        common_periods = [12, 24, 7, 30, 52]
        best_period = None
        best_strength = 0.0

        for period in common_periods:
            if period >= len(values_arr) // 2:
                continue

            # Calculate seasonality strength using autocorrelation
            strength = self._calculate_seasonality_strength(values_arr, period)

            if strength > best_strength:
                best_strength = strength
                best_period = period

        # Find peaks
        peaks = []
        if best_period and best_strength > 0.3:
            for i in range(best_period, len(values_arr) - best_period):
                if (values_arr[i] > values_arr[i - 1] and
                    values_arr[i] > values_arr[i + 1]):
                    peaks.append(int(i))

        return {
            'has_seasonality': best_strength > 0.3,
            'period': int(best_period) if best_period else None,
            'strength': float(min(1.0, best_strength)),
            'peaks': peaks[:10]  # Limit to 10 peaks
        }

    def _calculate_seasonality_strength(self, values: np.ndarray, period: int) -> float:
        """Calculate seasonality strength using variance ratio."""
        if len(values) < 2 * period:
            return 0.0

        # Split into seasonal components
        num_cycles = len(values) // period
        seasonal_components = []

        for i in range(period):
            indices = [i + j * period for j in range(num_cycles) if i + j * period < len(values)]
            if indices:
                seasonal_components.append(np.var(values[indices]))

        if not seasonal_components:
            return 0.0

        seasonal_var = np.mean(seasonal_components)
        residual_var = np.var(values)

        if residual_var == 0:
            return 0.0

        strength = seasonal_var / residual_var
        return float(min(1.0, strength))
