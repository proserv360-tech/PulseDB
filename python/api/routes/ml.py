"""Machine learning endpoints for anomaly detection, forecasting, and predictions.

Provides REST API endpoints that connect to ML modules for advanced time series analysis,
query optimization, and capacity planning.
"""

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from ..ml.anomaly_detector import AnomalyDetector
from ..ml.forecaster import MetricForecaster
from ..ml.query_classifier import QueryClassifier
from ..ml.capacity_predictor import CapacityPredictor

router = APIRouter(prefix="/api/ml", tags=["ml"])

# Initialize ML modules
_anomaly_detector = AnomalyDetector()
_forecaster = MetricForecaster()
_query_classifier = QueryClassifier()
_capacity_predictor = CapacityPredictor()


class MetricDataPoint(BaseModel):
    """A single metric data point with timestamp and value.

    Attributes:
        timestamp: ISO 8601 format datetime string
        value: Numeric metric value
    """

    timestamp: str
    value: float


class AnomalyDetectionRequest(BaseModel):
    """Request model for anomaly detection.

    Attributes:
        metric_name: Name of the metric being analyzed
        data_points: List of metric data points in chronological order
        sensitivity: Sensitivity threshold from 0.0 to 1.0 (default 0.8, lower is more sensitive)
        window_size: Rolling window size for analysis (default 20)
    """

    metric_name: str
    data_points: list[MetricDataPoint]
    sensitivity: float = Field(0.8, ge=0.0, le=1.0)
    window_size: int = Field(20, ge=3)


class AnomalyDataPoint(BaseModel):
    """Anomaly detection result for a single data point.

    Attributes:
        timestamp: ISO 8601 format datetime
        value: Original metric value
        is_anomaly: Whether this point was flagged as anomalous
        anomaly_score: Z-score or IQR-based anomaly score
        expected_range: Tuple of (lower_bound, upper_bound) for expected values
    """

    timestamp: str
    value: float
    is_anomaly: bool
    anomaly_score: float
    expected_range: tuple[float, float]


class AnomalyDetectionResponse(BaseModel):
    """Response model for anomaly detection.

    Attributes:
        metric_name: Name of analyzed metric
        anomalies_detected: Count of flagged anomalies
        results: List of analysis results for each data point
        baseline_mean: Mean value of the time series
        baseline_std: Standard deviation of the time series
    """

    metric_name: str
    anomalies_detected: int
    results: list[AnomalyDataPoint]
    baseline_mean: float
    baseline_std: float


class ForecastRequest(BaseModel):
    """Request model for time series forecasting.

    Attributes:
        metric_name: Name of the metric to forecast
        data_points: Historical metric data points
        forecast_hours: Number of hours to forecast (default 24)
        confidence_level: Confidence level for prediction bounds from 0.8 to 0.99 (default 0.95)
    """

    metric_name: str
    data_points: list[MetricDataPoint]
    forecast_hours: int = Field(24, ge=1, le=365)
    confidence_level: float = Field(0.95, ge=0.8, le=0.99)


class ForecastPoint(BaseModel):
    """A single forecast prediction point.

    Attributes:
        timestamp: Forecasted timestamp in ISO 8601 format
        predicted_value: Predicted metric value
        lower_bound: Lower confidence interval bound
        upper_bound: Upper confidence interval bound
        confidence: Confidence level of the prediction
    """

    timestamp: str
    predicted_value: float
    lower_bound: float
    upper_bound: float
    confidence: float


class ForecastResponse(BaseModel):
    """Response model for forecast results.

    Attributes:
        metric_name: Name of the forecasted metric
        forecast_hours: Number of hours forecasted
        historical_mean: Mean of historical data
        trend: Detected trend direction ("increasing", "decreasing", or "stable")
        predictions: List of forecast data points
    """

    metric_name: str
    forecast_hours: int
    historical_mean: float
    trend: str
    predictions: list[ForecastPoint]


class QueryClassificationRequest(BaseModel):
    """Request model for query classification.

    Attributes:
        query: SQL query string to classify
        execution_time_ms: Observed execution time in milliseconds
        rows_examined: Number of rows examined
        rows_returned: Number of rows returned
    """

    query: str = Field(..., min_length=1)
    execution_time_ms: float = Field(ge=0.0)
    rows_examined: int = Field(ge=0)
    rows_returned: int = Field(ge=0)


class QueryClassificationResponse(BaseModel):
    """Response model for query classification.

    Attributes:
        query: Original query string
        query_type: Classified query type (SELECT, INSERT, UPDATE, DELETE, etc.)
        complexity_level: Complexity category (simple, moderate, complex)
        complexity_score: Numeric complexity score (0-100)
        estimated_cost: Estimated query cost category
        classification_confidence: Confidence of classification (0-1)
    """

    query: str
    query_type: str
    complexity_level: str
    complexity_score: float
    estimated_cost: str
    classification_confidence: float


class CapacityPredictionRequest(BaseModel):
    """Request model for capacity prediction.

    Attributes:
        metric_type: Type of resource (cpu, memory, disk, connections)
        current_usage: Current resource usage (same units as historical)
        historical_data_points: Historical usage data points
        growth_rate_percent_per_day: Optional explicit growth rate (percent per day)
    """

    metric_type: str = Field(..., min_length=1)
    current_usage: float = Field(ge=0.0)
    historical_data_points: list[MetricDataPoint]
    growth_rate_percent_per_day: Optional[float] = None


class CapacityPredictionResponse(BaseModel):
    """Response model for capacity prediction.

    Attributes:
        metric_type: Type of resource predicted
        current_usage: Current usage value
        capacity_limit: Maximum capacity
        days_until_exhaustion: Estimated days until capacity exhaustion
        threshold_warning_percent: Warning threshold percentage
        recommended_action: Recommended action based on prediction
    """

    metric_type: str
    current_usage: float
    capacity_limit: float
    days_until_exhaustion: float
    threshold_warning_percent: float
    recommended_action: str


def _parse_timestamps_to_unix(data_points: list[MetricDataPoint]) -> list[int]:
    """Convert ISO 8601 timestamps to Unix timestamps.

    Args:
        data_points: List of metric data points with ISO timestamp strings

    Returns:
        List of Unix timestamps (seconds since epoch)

    Raises:
        HTTPException: If timestamp parsing fails
    """
    timestamps = []
    for dp in data_points:
        try:
            dt = datetime.fromisoformat(dp.timestamp.replace('Z', '+00:00'))
            timestamps.append(int(dt.timestamp()))
        except (ValueError, AttributeError) as e:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid timestamp format '{dp.timestamp}': {str(e)}"
            )
    return timestamps


def _unix_to_iso(unix_timestamp: int) -> str:
    """Convert Unix timestamp to ISO 8601 format.

    Args:
        unix_timestamp: Unix timestamp in seconds

    Returns:
        ISO 8601 format string with Z suffix
    """
    return datetime.fromtimestamp(unix_timestamp, tz=None).isoformat() + 'Z'


@router.post("/anomaly-detect", response_model=AnomalyDetectionResponse)
async def detect_anomalies(request: AnomalyDetectionRequest) -> AnomalyDetectionResponse:
    """Detect anomalies in metric time series data using statistical analysis.

    Uses Z-score and IQR methods to identify outliers in time series data.
    The sensitivity parameter controls the threshold for anomaly detection
    (lower values are more sensitive).

    Args:
        request: AnomalyDetectionRequest with metric data points

    Returns:
        AnomalyDetectionResponse with detected anomalies and statistics

    Raises:
        HTTPException: If data validation or analysis fails
    """
    try:
        if not request.data_points or len(request.data_points) < 3:
            raise HTTPException(
                status_code=400,
                detail="At least 3 data points are required for anomaly detection"
            )

        # Extract values and timestamps
        values = [dp.value for dp in request.data_points]
        timestamps = _parse_timestamps_to_unix(request.data_points)

        # Validate values
        if not all(isinstance(v, (int, float)) and not float('inf') <= v for v in values):
            raise HTTPException(
                status_code=400,
                detail="All values must be finite numeric values"
            )

        # Convert sensitivity (0-1) to threshold for detector (higher number = less sensitive)
        # sensitivity=0.0 -> threshold=2.0, sensitivity=1.0 -> threshold=0.0
        sensitivity_threshold = 2.0 - (request.sensitivity * 2.0)

        # Call actual detector
        result = _anomaly_detector.detect(
            values=values,
            timestamps=timestamps,
            sensitivity=sensitivity_threshold
        )

        # Extract statistics
        stats = result.get('stats', {})
        baseline_mean = stats.get('mean', 0.0)
        baseline_std = stats.get('std', 0.0)

        # Build results with expected ranges
        anomaly_results = []
        anomaly_count = 0

        for idx, dp in enumerate(request.data_points):
            # Check if this point is flagged as anomaly
            is_anomaly = any(a['index'] == idx for a in result.get('anomalies', []))
            if is_anomaly:
                anomaly_count += 1

            # Get anomaly score
            anomaly_score = 0.0
            for anomaly in result.get('anomalies', []):
                if anomaly['index'] == idx:
                    anomaly_score = min(anomaly['score'], 10.0)
                    break

            # Calculate expected range
            lower = baseline_mean - 2 * baseline_std
            upper = baseline_mean + 2 * baseline_std

            anomaly_results.append(
                AnomalyDataPoint(
                    timestamp=dp.timestamp,
                    value=dp.value,
                    is_anomaly=is_anomaly,
                    anomaly_score=anomaly_score,
                    expected_range=(lower, upper)
                )
            )

        return AnomalyDetectionResponse(
            metric_name=request.metric_name,
            anomalies_detected=anomaly_count,
            results=anomaly_results,
            baseline_mean=baseline_mean,
            baseline_std=baseline_std
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Anomaly detection failed: {str(e)}"
        )


@router.post("/forecast", response_model=ForecastResponse)
async def forecast_metrics(request: ForecastRequest) -> ForecastResponse:
    """Forecast metric values for the next N hours using time series prediction.

    Uses an ensemble of methods (linear regression, exponential smoothing, moving
    average) to predict future metric values with confidence intervals.

    Args:
        request: ForecastRequest with historical data and forecast period

    Returns:
        ForecastResponse with predicted values and confidence bounds

    Raises:
        HTTPException: If data validation or forecasting fails
    """
    try:
        if not request.data_points or len(request.data_points) < 3:
            raise HTTPException(
                status_code=400,
                detail="At least 3 historical data points are required for forecasting"
            )

        # Extract values and timestamps
        values = [dp.value for dp in request.data_points]
        timestamps = _parse_timestamps_to_unix(request.data_points)

        # Validate values
        if not all(isinstance(v, (int, float)) and not float('inf') <= v for v in values):
            raise HTTPException(
                status_code=400,
                detail="All values must be finite numeric values"
            )

        # Call actual forecaster
        result = _forecaster.forecast(
            values=values,
            timestamps=timestamps,
            horizon=request.forecast_hours
        )

        # Determine trend from historical data
        if len(values) > 1:
            recent_trend = (values[-1] - values[0]) / len(values)
            mean_val = sum(values) / len(values)
            if recent_trend > mean_val * 0.05:
                trend = "increasing"
            elif recent_trend < -mean_val * 0.05:
                trend = "decreasing"
            else:
                trend = "stable"
        else:
            trend = "stable"

        # Build forecast points from predictions
        forecast_points = []
        for pred in result.get('predictions', []):
            forecast_points.append(
                ForecastPoint(
                    timestamp=_unix_to_iso(pred['timestamp']),
                    predicted_value=pred['value'],
                    lower_bound=pred['lower_bound'],
                    upper_bound=pred['upper_bound'],
                    confidence=request.confidence_level
                )
            )

        historical_mean = sum(values) / len(values) if values else 0.0

        return ForecastResponse(
            metric_name=request.metric_name,
            forecast_hours=request.forecast_hours,
            historical_mean=historical_mean,
            trend=trend,
            predictions=forecast_points
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Forecasting failed: {str(e)}"
        )


@router.post("/query-classify", response_model=QueryClassificationResponse)
async def classify_query(request: QueryClassificationRequest) -> QueryClassificationResponse:
    """Classify a SQL query by type and estimate its complexity level.

    Analyzes query structure to determine type (SELECT, INSERT, etc.),
    complexity level, resource impact, and provides optimization recommendations.

    Args:
        request: QueryClassificationRequest with SQL query and metrics

    Returns:
        QueryClassificationResponse with classification results

    Raises:
        HTTPException: If query analysis fails
    """
    try:
        if not request.query.strip():
            raise HTTPException(
                status_code=400,
                detail="Query cannot be empty"
            )

        # Call actual classifier
        classification = _query_classifier.classify(request.query)

        # Map complexity score (0-100) to level
        complexity_score = classification.get('complexity_score', 0)
        if complexity_score < 33:
            complexity_level = "simple"
        elif complexity_score < 66:
            complexity_level = "moderate"
        else:
            complexity_level = "complex"

        # Get query type and cost
        query_type = classification.get('type', 'UNKNOWN')
        estimated_cost = classification.get('estimated_cost', 'medium')

        # Calculate confidence based on query type
        # More common patterns have higher confidence
        classification_confidence = 0.85 if query_type != 'UNKNOWN' else 0.70

        return QueryClassificationResponse(
            query=request.query,
            query_type=query_type,
            complexity_level=complexity_level,
            complexity_score=float(complexity_score),
            estimated_cost=estimated_cost,
            classification_confidence=classification_confidence
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Query classification failed: {str(e)}"
        )


@router.post("/capacity-predict", response_model=CapacityPredictionResponse)
async def predict_capacity(request: CapacityPredictionRequest) -> CapacityPredictionResponse:
    """Predict when system resources will be exhausted based on current trends.

    Analyzes historical usage patterns to forecast when capacity limits will be
    reached and provides actionable recommendations.

    Args:
        request: CapacityPredictionRequest with resource usage data

    Returns:
        CapacityPredictionResponse with exhaustion predictions and recommendations

    Raises:
        HTTPException: If data validation or prediction fails
    """
    try:
        if not request.metric_type or not request.metric_type.strip():
            raise HTTPException(
                status_code=400,
                detail="metric_type must be specified (cpu, memory, disk, or connections)"
            )

        if request.current_usage < 0:
            raise HTTPException(
                status_code=400,
                detail="current_usage must be non-negative"
            )

        if not request.historical_data_points or len(request.historical_data_points) < 2:
            raise HTTPException(
                status_code=400,
                detail="At least 2 historical data points are required"
            )

        # Define capacity limits for each metric type
        capacity_limits = {
            "cpu": 100.0,
            "memory": 100.0,
            "disk": 100.0,
            "connections": 500.0,
        }

        capacity_limit = capacity_limits.get(request.metric_type, 100.0)

        # Validate current usage doesn't exceed capacity
        if request.current_usage > capacity_limit:
            raise HTTPException(
                status_code=400,
                detail=f"current_usage ({request.current_usage}) exceeds capacity_limit ({capacity_limit})"
            )

        # Convert data points to format expected by predictor
        historical_data = []
        for dp in request.historical_data_points:
            try:
                dt = datetime.fromisoformat(dp.timestamp.replace('Z', '+00:00'))
                unix_ts = int(dt.timestamp())
                historical_data.append({
                    'timestamp': unix_ts,
                    'value': dp.value
                })
            except (ValueError, AttributeError) as e:
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid timestamp format in historical data: {str(e)}"
                )

        # Call actual capacity predictor
        prediction = _capacity_predictor.predict(
            current_usage=request.current_usage,
            historical=historical_data,
            capacity=capacity_limit
        )

        # Extract results
        days_remaining = prediction.get('days_remaining')
        if days_remaining is None:
            days_remaining = 999.0
        else:
            days_remaining = min(float(days_remaining), 999.0)

        recommendation = prediction.get('recommendation', 'Unable to generate recommendation')

        return CapacityPredictionResponse(
            metric_type=request.metric_type,
            current_usage=request.current_usage,
            capacity_limit=capacity_limit,
            days_until_exhaustion=days_remaining,
            threshold_warning_percent=80.0,
            recommended_action=recommendation
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Capacity prediction failed: {str(e)}"
        )
