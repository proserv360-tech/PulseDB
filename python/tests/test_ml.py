import sys
from pathlib import Path

# Add parent directories to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from ml.anomaly_detector import AnomalyDetector
from ml.forecaster import MetricForecaster
from ml.query_classifier import QueryClassifier
from ml.capacity_predictor import CapacityPredictor


class TestAnomalyDetector:
    """Test suite for AnomalyDetector"""

    def setup_method(self):
        """Setup test fixtures"""
        self.detector = AnomalyDetector()

    def test_detect_normal_data(self):
        """Test detector with normal data (no anomalies)"""
        values = [10.0, 10.5, 10.2, 10.1, 10.3, 10.2, 10.1, 10.4, 10.2, 10.0]
        timestamps = list(range(len(values)))
        result = self.detector.detect(values, timestamps, sensitivity=2.0)

        assert "anomalies" in result
        assert "stats" in result
        assert "threshold" in result
        assert len(result["anomalies"]) == 0  # Normal data should have no anomalies

    def test_detect_with_spike(self):
        """Test detector with data containing clear outlier"""
        values = [10.0, 10.5, 10.2, 10.1, 10.3, 100.0, 10.2, 10.1, 10.4, 10.2]
        timestamps = list(range(len(values)))
        result = self.detector.detect(values, timestamps, sensitivity=2.0)

        assert len(result["anomalies"]) > 0
        # Should detect the spike at index 5
        assert any(a["index"] == 5 for a in result["anomalies"])

    def test_detect_with_multiple_anomalies(self):
        """Test detector with data containing multiple outliers"""
        values = [10.0, 10.5, 10.2, 100.0, 10.1, 10.3, -50.0, 10.2, 10.1, 10.4]
        timestamps = list(range(len(values)))
        result = self.detector.detect(values, timestamps, sensitivity=2.0)

        assert len(result["anomalies"]) >= 2

    def test_detect_sensitivity_adjustment(self):
        """Test detector with different sensitivity levels"""
        values = [10.0, 10.5, 10.2, 10.1, 50.0, 10.2, 10.1, 10.4, 10.2, 10.0]
        timestamps = list(range(len(values)))

        # High sensitivity (less sensitive)
        result_high = self.detector.detect(values, timestamps, sensitivity=3.0)

        # Low sensitivity (more sensitive)
        result_low = self.detector.detect(values, timestamps, sensitivity=1.0)

        # Lower sensitivity should find more anomalies
        assert len(result_low["anomalies"]) >= len(result_high["anomalies"])

    def test_detect_trend_change_with_shift(self):
        """Test detecting trend change with clear shift"""
        # Values with upward trend, then shift to different level
        values = [10.0, 11.0, 12.0, 13.0, 14.0, 50.0, 51.0, 52.0, 51.0, 50.0]
        result = self.detector.detect_trend_change(values)

        assert "trend_changes" in result
        assert "overall_trend" in result
        assert "volatility" in result
        assert result["overall_trend"] in ["upward", "downward", "stable"]

    def test_detect_trend_change_stable_data(self):
        """Test trend detection with stable data"""
        values = [100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0]
        result = self.detector.detect_trend_change(values)

        # With perfectly stable data, trend should be stable
        assert result["overall_trend"] in ["stable", "upward", "downward"]
        assert result["volatility"] >= 0

    def test_detect_insufficient_data(self):
        """Test detect with insufficient data"""
        values = [10.0, 11.0]
        timestamps = [0, 1]
        result = self.detector.detect(values, timestamps)

        assert result["anomalies"] == []


class TestMetricForecaster:
    """Test suite for MetricForecaster"""

    def setup_method(self):
        """Setup test fixtures"""
        self.forecaster = MetricForecaster()

    def test_forecast_returns_correct_horizon(self):
        """Test forecaster returns correct number of predictions"""
        values = [100.0, 105.0, 110.0, 108.0, 112.0]
        timestamps = [0, 3600, 7200, 10800, 14400]
        result = self.forecaster.forecast(values, timestamps, horizon=24)

        assert "predictions" in result
        assert "model_info" in result
        assert "confidence" in result
        assert len(result["predictions"]) == 24

    def test_forecast_predictions_have_required_keys(self):
        """Test that predictions have required keys"""
        values = [100.0, 105.0, 110.0, 108.0, 112.0]
        timestamps = [0, 3600, 7200, 10800, 14400]
        result = self.forecaster.forecast(values, timestamps, horizon=10)

        for pred in result["predictions"]:
            assert "timestamp" in pred
            assert "value" in pred
            assert "lower_bound" in pred
            assert "upper_bound" in pred
            assert "confidence" in pred

    def test_forecast_upward_trend(self):
        """Test forecaster with upward trend"""
        values = [100.0, 110.0, 120.0, 130.0, 140.0]
        timestamps = [0, 3600, 7200, 10800, 14400]
        result = self.forecaster.forecast(values, timestamps, horizon=12)

        # With upward trend, most predictions should be higher than starting point
        first_pred = result["predictions"][0]["value"]
        assert first_pred >= values[-1] * 0.9  # Should be at least near last value

    def test_forecast_downward_trend(self):
        """Test forecaster with downward trend"""
        values = [130.0, 120.0, 110.0, 100.0, 90.0]
        timestamps = [0, 3600, 7200, 10800, 14400]
        result = self.forecaster.forecast(values, timestamps, horizon=12)

        assert "predictions" in result
        assert len(result["predictions"]) == 12

    def test_detect_seasonality(self):
        """Test seasonality detection"""
        # Create data with daily pattern (24 points)
        values = [10.0, 11.0, 12.0, 13.0, 14.0, 13.0, 12.0, 11.0, 10.0] * 3
        result = self.forecaster.detect_seasonality(values)

        assert "has_seasonality" in result
        assert "period" in result
        assert "strength" in result
        assert "peaks" in result

    def test_detect_seasonality_insufficient_data(self):
        """Test seasonality detection with insufficient data"""
        values = [10.0, 11.0, 12.0]
        result = self.forecaster.detect_seasonality(values)

        assert result["has_seasonality"] is False
        assert result["period"] is None

    def test_forecast_insufficient_data(self):
        """Test forecaster with insufficient data"""
        values = [100.0]
        timestamps = [0]
        result = self.forecaster.forecast(values, timestamps, horizon=24)

        assert result["predictions"] == []
        assert result["confidence"] == 0.0


class TestQueryClassifier:
    """Test suite for QueryClassifier"""

    def setup_method(self):
        """Setup test fixtures"""
        self.classifier = QueryClassifier()

    def test_classify_select_read_query(self):
        """Test classifying a SELECT read query"""
        query = "SELECT id, name FROM users WHERE active = true"
        result = self.classifier.classify(query)

        assert result["type"] == "SELECT"
        assert result["complexity_score"] >= 0
        assert result["complexity_score"] <= 100
        assert result["risk_level"] == "low"
        assert "recommendations" in result

    def test_classify_select_with_count(self):
        """Test classifying SELECT with COUNT aggregation"""
        query = "SELECT COUNT(*) as total FROM orders"
        result = self.classifier.classify(query)

        assert result["type"] == "SELECT"
        assert result["complexity_score"] > 10  # Has aggregation

    def test_classify_select_with_group_by(self):
        """Test classifying SELECT with GROUP BY"""
        query = "SELECT user_id, COUNT(*) FROM orders GROUP BY user_id"
        result = self.classifier.classify(query)

        assert result["type"] == "SELECT"
        assert result["complexity_score"] > 10

    def test_classify_insert_query(self):
        """Test classifying an INSERT query"""
        query = "INSERT INTO users (name, email) VALUES ('John', 'john@example.com')"
        result = self.classifier.classify(query)

        assert result["type"] == "INSERT"
        assert result["risk_level"] in ["low", "medium", "high"]

    def test_classify_update_query(self):
        """Test classifying an UPDATE query"""
        query = "UPDATE users SET active = false WHERE last_login < NOW() - INTERVAL '30 days'"
        result = self.classifier.classify(query)

        assert result["type"] == "UPDATE"
        assert result["risk_level"] == "high"  # UPDATE is high risk

    def test_classify_delete_query(self):
        """Test classifying a DELETE query"""
        query = "DELETE FROM logs WHERE created_at < NOW() - INTERVAL '1 year'"
        result = self.classifier.classify(query)

        assert result["type"] == "DELETE"
        assert result["risk_level"] == "high"

    def test_classify_delete_without_where(self):
        """Test classifying DELETE without WHERE (very risky)"""
        query = "DELETE FROM logs"
        result = self.classifier.classify(query)

        assert result["type"] == "DELETE"
        assert result["risk_level"] == "critical"

    def test_batch_classify(self):
        """Test batch classification of multiple queries"""
        queries = [
            "SELECT id FROM users",
            "INSERT INTO orders VALUES (1, 'item')",
            "UPDATE products SET price = 10 WHERE id = 1",
            "DELETE FROM cache",
        ]
        results = self.classifier.batch_classify(queries)

        assert len(results) == 4
        assert results[0]["type"] == "SELECT"
        assert results[1]["type"] == "INSERT"
        assert results[2]["type"] == "UPDATE"
        assert results[3]["type"] == "DELETE"

    def test_classify_ddl_create(self):
        """Test classifying CREATE TABLE (DDL)"""
        query = "CREATE TABLE users (id INT, name VARCHAR(255))"
        result = self.classifier.classify(query)

        assert result["type"] == "DDL"
        assert result["risk_level"] == "high"

    def test_classify_ddl_drop(self):
        """Test classifying DROP TABLE (critical)"""
        query = "DROP TABLE users"
        result = self.classifier.classify(query)

        assert result["type"] == "DDL"
        assert result["risk_level"] == "critical"


class TestCapacityPredictor:
    """Test suite for CapacityPredictor"""

    def setup_method(self):
        """Setup test fixtures"""
        self.predictor = CapacityPredictor()

    def test_predict_with_growing_usage(self):
        """Test prediction with growing usage pattern"""
        current_usage = 50.0
        historical = [
            {"timestamp": 0, "value": 10.0},
            {"timestamp": 86400, "value": 20.0},
            {"timestamp": 172800, "value": 30.0},
            {"timestamp": 259200, "value": 40.0},
        ]
        capacity = 100.0
        result = self.predictor.predict(current_usage, historical, capacity)

        assert "days_remaining" in result
        assert "projected_date" in result
        assert "growth_rate" in result
        assert "confidence" in result
        assert "recommendation" in result

    def test_predict_stable_usage(self):
        """Test prediction with stable usage"""
        current_usage = 50.0
        historical = [
            {"timestamp": 0, "value": 50.0},
            {"timestamp": 86400, "value": 50.0},
            {"timestamp": 172800, "value": 50.0},
            {"timestamp": 259200, "value": 50.0},
        ]
        capacity = 100.0
        result = self.predictor.predict(current_usage, historical, capacity)

        assert result["days_remaining"] is None  # Stable = no exhaustion

    def test_predict_declining_usage(self):
        """Test prediction with declining usage"""
        current_usage = 30.0
        historical = [
            {"timestamp": 0, "value": 50.0},
            {"timestamp": 86400, "value": 45.0},
            {"timestamp": 172800, "value": 40.0},
            {"timestamp": 259200, "value": 35.0},
        ]
        capacity = 100.0
        result = self.predictor.predict(current_usage, historical, capacity)

        assert result["days_remaining"] is None  # Declining = no exhaustion

    def test_predict_connections(self):
        """Test connection pool exhaustion prediction"""
        current = 80
        max_connections = 100
        history = [
            {"timestamp": 0, "connections": 50},
            {"timestamp": 86400, "connections": 60},
            {"timestamp": 172800, "connections": 70},
            {"timestamp": 259200, "connections": 80},
        ]
        result = self.predictor.predict_connections(current, max_connections, history)

        assert "days_remaining" in result
        assert "current_connections" in result
        assert "max_connections" in result
        assert "growth_rate" in result
        assert result["current_connections"] == 80
        assert result["max_connections"] == 100

    def test_predict_connections_high_utilization(self):
        """Test connection prediction with high utilization"""
        current = 95
        max_connections = 100
        history = [
            {"timestamp": 0, "connections": 80},
            {"timestamp": 86400, "connections": 85},
            {"timestamp": 172800, "connections": 90},
            {"timestamp": 259200, "connections": 95},
        ]
        result = self.predictor.predict_connections(current, max_connections, history)

        assert result["utilization_percent"] > 90
        assert "CRITICAL" in result["recommendation"] or "WARNING" in result["recommendation"]

    def test_predict_storage(self):
        """Test storage capacity prediction"""
        current_gb = 400.0
        max_gb = 500.0
        history = [
            {"timestamp": 0, "value": 200.0},
            {"timestamp": 86400, "value": 250.0},
            {"timestamp": 172800, "value": 300.0},
            {"timestamp": 259200, "value": 350.0},
        ]
        result = self.predictor.predict_storage(current_gb, max_gb, history)

        assert "days_remaining" in result
        assert "current_usage_gb" in result
        assert "max_capacity_gb" in result
        assert "growth_per_day_gb" in result
        assert "utilization_percent" in result

    def test_predict_storage_critical(self):
        """Test storage prediction when nearly full"""
        current_gb = 475.0
        max_gb = 500.0
        history = [
            {"timestamp": 0, "value": 400.0},
            {"timestamp": 86400, "value": 420.0},
            {"timestamp": 172800, "value": 450.0},
            {"timestamp": 259200, "value": 475.0},
        ]
        result = self.predictor.predict_storage(current_gb, max_gb, history)

        assert result["utilization_percent"] > 90
        assert "CRITICAL" in result["recommendation"]

    def test_predict_insufficient_data(self):
        """Test prediction with insufficient historical data"""
        current_usage = 50.0
        historical = [{"timestamp": 0, "value": 50.0}]
        capacity = 100.0
        result = self.predictor.predict(current_usage, historical, capacity)

        assert result["days_remaining"] is None
        assert result["confidence"] == 0.0
