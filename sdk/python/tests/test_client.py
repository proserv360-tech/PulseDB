"""Tests for FathomSDK client."""

import pytest
import httpx
from unittest.mock import Mock, patch, MagicMock
from fathom_sdk import FathomSDK
from fathom_sdk.events import SdkEvent


class TestFathomSDKInit:
    """Tests for FathomSDK initialization."""

    def test_init_requires_api_key(self):
        """API key is required."""
        with pytest.raises(ValueError, match="api_key is required"):
            FathomSDK(api_key="", endpoint="https://example.com")

    def test_init_requires_endpoint(self):
        """Endpoint is required."""
        with pytest.raises(ValueError, match="endpoint is required"):
            FathomSDK(api_key="sk_live_test", endpoint="")

    def test_init_success(self):
        """SDK initializes successfully with valid args."""
        sdk = FathomSDK(
            api_key="sk_live_test",
            endpoint="https://api.example.com",
            app_name="test-app",
            environment="test",
        )

        assert sdk.api_key == "sk_live_test"
        assert sdk.endpoint == "https://api.example.com"
        assert sdk.app_name == "test-app"
        assert sdk.environment == "test"
        assert sdk.session_id is not None
        assert "-" in sdk.session_id  # <millis>-<hex>

        sdk.shutdown()

    def test_init_strips_trailing_slash(self):
        """Trailing slash is stripped from endpoint."""
        sdk = FathomSDK(
            api_key="sk_live_test",
            endpoint="https://api.example.com/",
        )
        assert sdk.endpoint == "https://api.example.com"
        sdk.shutdown()


class TestSessionId:
    """Tests for session ID generation."""

    def test_session_id_format(self):
        """Session ID has correct format: <millis>-<8-hex>."""
        sdk = FathomSDK(api_key="sk_live_test", endpoint="https://api.example.com")
        sid = sdk.session_id

        parts = sid.split("-")
        assert len(parts) == 2, f"Session ID should have 2 parts: {sid}"

        millis, hex_part = parts
        assert millis.isdigit(), f"First part should be millis: {millis}"
        assert len(hex_part) == 8, f"Second part should be 8 hex chars: {hex_part}"

        sdk.shutdown()


class TestTrackAPI:
    """Tests for track_api method."""

    def test_track_api_creates_event(self):
        """track_api enqueues an event with correct shape."""
        mock_http = MagicMock(spec=httpx.Client)
        mock_http.post.return_value = Mock(status_code=200, json=lambda: {"ingested": 1})

        sdk = FathomSDK(
            api_key="sk_live_test",
            endpoint="https://api.example.com",
            http_client=mock_http,
            debug=False,
        )

        sdk.track_api(
            method="GET",
            endpoint="/users",
            status_code=200,
            duration_ms=42,
            metadata={"userId": "123"},
        )

        # Flush to trigger HTTP call
        sdk.flush()

        # Check POST was called
        assert mock_http.post.called
        call_args = mock_http.post.call_args
        body = call_args.kwargs.get("content")

        import json

        payload = json.loads(body)

        assert "events" in payload
        assert len(payload["events"]) == 1

        event = payload["events"][0]
        assert event["type"] == "api"
        assert event["title"] == "GET /users"
        assert event["severity"] == "info"
        assert event["metadata"]["statusCode"] == 200
        assert event["metadata"]["durationMs"] == 42
        assert event["metadata"]["userId"] == "123"

        sdk.shutdown()

    def test_track_api_severity_mapping(self):
        """track_api auto-maps severity based on status code."""
        mock_http = MagicMock(spec=httpx.Client)
        mock_http.post.return_value = Mock(status_code=200, json=lambda: {"ingested": 3})

        sdk = FathomSDK(
            api_key="sk_live_test",
            endpoint="https://api.example.com",
            http_client=mock_http,
        )

        # Test 200 -> info
        sdk.track_api("GET", "/ok", 200, 10)

        # Test 400 -> warning
        sdk.track_api("POST", "/bad", 400, 10)

        # Test 500 -> error
        sdk.track_api("GET", "/error", 500, 10)

        sdk.flush()

        assert mock_http.post.called
        call_args = mock_http.post.call_args
        body = call_args.kwargs.get("content")

        import json

        payload = json.loads(body)

        events = payload["events"]
        assert events[0]["severity"] == "info"  # 200
        assert events[1]["severity"] == "warning"  # 400
        assert events[2]["severity"] == "error"  # 500

        sdk.shutdown()


class TestTrackError:
    """Tests for track_error method."""

    def test_track_error_with_exception(self):
        """track_error captures exception details."""
        mock_http = MagicMock(spec=httpx.Client)
        mock_http.post.return_value = Mock(status_code=200, json=lambda: {"ingested": 1})

        sdk = FathomSDK(
            api_key="sk_live_test",
            endpoint="https://api.example.com",
            http_client=mock_http,
        )

        try:
            raise ValueError("Test error")
        except ValueError as e:
            sdk.track_error(e, metadata={"context": "test"})

        sdk.flush()

        assert mock_http.post.called
        call_args = mock_http.post.call_args
        body = call_args.kwargs.get("content")

        import json

        payload = json.loads(body)

        event = payload["events"][0]
        assert event["type"] == "error"
        assert event["severity"] == "error"
        assert "ValueError" in event["title"]
        assert event["metadata"]["name"] == "ValueError"
        assert event["metadata"]["message"] == "Test error"
        assert "stack" in event["metadata"]
        assert "context" in event["metadata"]

        sdk.shutdown()

    def test_track_error_with_string(self):
        """track_error accepts a string."""
        mock_http = MagicMock(spec=httpx.Client)
        mock_http.post.return_value = Mock(status_code=200, json=lambda: {"ingested": 1})

        sdk = FathomSDK(
            api_key="sk_live_test",
            endpoint="https://api.example.com",
            http_client=mock_http,
        )

        sdk.track_error("Custom error message")
        sdk.flush()

        assert mock_http.post.called
        call_args = mock_http.post.call_args
        body = call_args.kwargs.get("content")

        import json

        payload = json.loads(body)

        event = payload["events"][0]
        assert event["type"] == "error"
        assert event["title"] == "Custom error message"

        sdk.shutdown()


class TestTrackAudit:
    """Tests for track_audit method."""

    def test_track_audit(self):
        """track_audit enqueues an audit event."""
        mock_http = MagicMock(spec=httpx.Client)
        mock_http.post.return_value = Mock(status_code=200, json=lambda: {"ingested": 1})

        sdk = FathomSDK(
            api_key="sk_live_test",
            endpoint="https://api.example.com",
            http_client=mock_http,
        )

        sdk.track_audit(
            title="User login",
            message="User 123 logged in",
            severity="info",
            metadata={"userId": "123"},
        )

        sdk.flush()

        assert mock_http.post.called
        call_args = mock_http.post.call_args
        body = call_args.kwargs.get("content")

        import json

        payload = json.loads(body)

        event = payload["events"][0]
        assert event["type"] == "audit"
        assert event["title"] == "User login"
        assert event["metadata"]["message"] == "User 123 logged in"

        sdk.shutdown()


class TestTrackMetric:
    """Tests for track_metric method."""

    def test_track_metric(self):
        """track_metric enqueues a metric event."""
        mock_http = MagicMock(spec=httpx.Client)
        mock_http.post.return_value = Mock(status_code=200, json=lambda: {"ingested": 1})

        sdk = FathomSDK(
            api_key="sk_live_test",
            endpoint="https://api.example.com",
            http_client=mock_http,
        )

        sdk.track_metric(
            title="Response Time",
            value=42.5,
            unit="ms",
            metadata={"endpoint": "/api/users"},
        )

        sdk.flush()

        assert mock_http.post.called
        call_args = mock_http.post.call_args
        body = call_args.kwargs.get("content")

        import json

        payload = json.loads(body)

        event = payload["events"][0]
        assert event["type"] == "metric"
        assert event["title"] == "Response Time"
        assert event["metadata"]["value"] == 42.5
        assert event["metadata"]["unit"] == "ms"

        sdk.shutdown()


class TestTrackCustom:
    """Tests for track (generic) method."""

    def test_track_custom_event(self):
        """track allows custom event types."""
        mock_http = MagicMock(spec=httpx.Client)
        mock_http.post.return_value = Mock(status_code=200, json=lambda: {"ingested": 1})

        sdk = FathomSDK(
            api_key="sk_live_test",
            endpoint="https://api.example.com",
            http_client=mock_http,
        )

        sdk.track(
            event_type="custom_type",
            title="Custom Event",
            severity="warning",
            message="Something happened",
            tags=["important", "test"],
            metadata={"custom": "data"},
        )

        sdk.flush()

        assert mock_http.post.called
        call_args = mock_http.post.call_args
        body = call_args.kwargs.get("content")

        import json

        payload = json.loads(body)

        event = payload["events"][0]
        assert event["type"] == "custom_type"
        assert event["title"] == "Custom Event"
        assert event["severity"] == "warning"
        assert event["message"] == "Something happened"
        assert event["metadata"]["tags"] == ["important", "test"]
        assert event["metadata"]["custom"] == "data"

        sdk.shutdown()


class TestHeartbeat:
    """Tests for heartbeat method."""

    def test_heartbeat_success(self):
        """heartbeat sends POST to /api/sdk/heartbeat."""
        mock_http = MagicMock(spec=httpx.Client)
        mock_http.post.return_value = Mock(status_code=200, json=lambda: {"acknowledged": True})

        sdk = FathomSDK(
            api_key="sk_live_test",
            endpoint="https://api.example.com",
            http_client=mock_http,
        )

        result = sdk.heartbeat(status="healthy", metadata={"version": "1.0"})

        assert result is True
        assert mock_http.post.called

        call_args = mock_http.post.call_args
        url = call_args[0][0] if call_args[0] else call_args.kwargs.get("url")
        assert "/api/sdk/heartbeat" in url

        body = call_args.kwargs.get("content")

        import json

        payload = json.loads(body)

        assert payload["status"] == "healthy"
        assert payload["sessionId"] == sdk.session_id
        assert payload["appName"] == sdk.app_name
        assert payload["metadata"]["version"] == "1.0"

        sdk.shutdown()


class TestShutdown:
    """Tests for shutdown method."""

    def test_shutdown_is_idempotent(self):
        """shutdown can be called multiple times safely."""
        mock_http = MagicMock(spec=httpx.Client)
        mock_http.post.return_value = Mock(status_code=200, json=lambda: {"ingested": 0})

        sdk = FathomSDK(
            api_key="sk_live_test",
            endpoint="https://api.example.com",
            http_client=mock_http,
        )

        sdk.shutdown()
        sdk.shutdown()  # Should not raise

    def test_shutdown_flushes_pending_events(self):
        """shutdown flushes remaining events before stopping."""
        mock_http = MagicMock(spec=httpx.Client)
        mock_http.post.return_value = Mock(status_code=200, json=lambda: {"ingested": 1})

        sdk = FathomSDK(
            api_key="sk_live_test",
            endpoint="https://api.example.com",
            http_client=mock_http,
            batch_size=100,  # Large batch size to prevent auto-flush
        )

        sdk.track_api("GET", "/test", 200, 10)

        # Shutdown should flush
        sdk.shutdown()

        assert mock_http.post.called
