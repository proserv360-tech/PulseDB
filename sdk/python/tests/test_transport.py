"""Tests for FathomTransport."""

import pytest
from unittest.mock import Mock, MagicMock, patch
import httpx
from fathom_sdk.transport import FathomTransport


class TestFathomTransport:
    """Tests for FathomTransport."""

    def test_init_validates_args(self):
        """Transport initializes with required args."""
        transport = FathomTransport(
            api_key="sk_live_test",
            endpoint="https://api.example.com",
        )

        assert transport.api_key == "sk_live_test"
        assert transport.endpoint == "https://api.example.com"

    def test_post_ingest_success(self):
        """post_ingest returns success with ingested count."""
        mock_client = MagicMock(spec=httpx.Client)
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"ingested": 2}
        mock_client.post.return_value = mock_response

        transport = FathomTransport(
            api_key="sk_live_test",
            endpoint="https://api.example.com",
            http_client=mock_client,
        )

        events = [
            {"type": "api", "title": "GET /", "severity": "info"},
            {"type": "api", "title": "POST /users", "severity": "info"},
        ]

        success, ingested, error = transport.post_ingest(events)

        assert success is True
        assert ingested == 2
        assert error is None

        # Check request
        assert mock_client.post.called
        call_args = mock_client.post.call_args
        assert "X-SDK-Key" in call_args.kwargs.get("headers", {})
        assert call_args.kwargs["headers"]["X-SDK-Key"] == "sk_live_test"

    def test_post_ingest_max_100_events(self):
        """API enforces max 100 events per request."""
        # Backend test would validate this; SDK doesn't pre-validate
        # Just ensure transport sends what's given
        mock_client = MagicMock(spec=httpx.Client)
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"ingested": 100}
        mock_client.post.return_value = mock_response

        transport = FathomTransport(
            api_key="sk_live_test",
            endpoint="https://api.example.com",
            http_client=mock_client,
        )

        events = [{"type": "test", "title": f"Event {i}", "severity": "info"} for i in range(100)]

        success, ingested, error = transport.post_ingest(events)

        assert success is True
        assert ingested == 100

    def test_post_ingest_retry_on_500(self):
        """post_ingest retries on 5xx status."""
        mock_client = MagicMock(spec=httpx.Client)

        # First call fails with 500, second succeeds
        mock_response_500 = Mock()
        mock_response_500.status_code = 500
        mock_response_500.text = "Server error"

        mock_response_200 = Mock()
        mock_response_200.status_code = 200
        mock_response_200.json.return_value = {"ingested": 1}

        mock_client.post.side_effect = [mock_response_500, mock_response_200]

        transport = FathomTransport(
            api_key="sk_live_test",
            endpoint="https://api.example.com",
            http_client=mock_client,
            max_retries=3,
        )

        events = [{"type": "test", "title": "Test", "severity": "info"}]

        success, ingested, error = transport.post_ingest(events)

        assert success is True
        assert ingested == 1
        assert mock_client.post.call_count == 2  # Retried once

    def test_post_ingest_retry_on_429(self):
        """post_ingest retries on 429 (rate limit)."""
        mock_client = MagicMock(spec=httpx.Client)

        mock_response_429 = Mock()
        mock_response_429.status_code = 429
        mock_response_429.text = "Rate limited"

        mock_response_200 = Mock()
        mock_response_200.status_code = 200
        mock_response_200.json.return_value = {"ingested": 1}

        mock_client.post.side_effect = [mock_response_429, mock_response_200]

        transport = FathomTransport(
            api_key="sk_live_test",
            endpoint="https://api.example.com",
            http_client=mock_client,
            max_retries=3,
        )

        events = [{"type": "test", "title": "Test", "severity": "info"}]

        success, ingested, error = transport.post_ingest(events)

        assert success is True
        assert ingested == 1
        assert mock_client.post.call_count == 2  # Retried once

    def test_post_ingest_no_retry_on_400(self):
        """post_ingest does NOT retry on 4xx (except 429)."""
        mock_client = MagicMock(spec=httpx.Client)

        mock_response_400 = Mock()
        mock_response_400.status_code = 400
        mock_response_400.text = "Bad request"

        mock_client.post.return_value = mock_response_400

        transport = FathomTransport(
            api_key="sk_live_test",
            endpoint="https://api.example.com",
            http_client=mock_client,
            max_retries=3,
        )

        events = [{"type": "test", "title": "Test", "severity": "info"}]

        success, ingested, error = transport.post_ingest(events)

        assert success is False
        assert ingested == 0
        assert error is not None
        assert mock_client.post.call_count == 1  # No retry

    def test_post_ingest_max_retries_exhausted(self):
        """post_ingest gives up after max_retries."""
        mock_client = MagicMock(spec=httpx.Client)

        mock_response = Mock()
        mock_response.status_code = 500
        mock_response.text = "Server error"

        mock_client.post.return_value = mock_response

        transport = FathomTransport(
            api_key="sk_live_test",
            endpoint="https://api.example.com",
            http_client=mock_client,
            max_retries=2,
        )

        events = [{"type": "test", "title": "Test", "severity": "info"}]

        success, ingested, error = transport.post_ingest(events)

        assert success is False
        assert ingested == 0
        assert mock_client.post.call_count == 3  # Initial + 2 retries

    def test_post_heartbeat_success(self):
        """post_heartbeat returns success."""
        mock_client = MagicMock(spec=httpx.Client)
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"acknowledged": True}
        mock_client.post.return_value = mock_response

        transport = FathomTransport(
            api_key="sk_live_test",
            endpoint="https://api.example.com",
            http_client=mock_client,
        )

        success, error = transport.post_heartbeat(
            status="healthy",
            session_id="123-abc",
            app_name="test-app",
            environment="test",
            queue_size=5,
            timestamp="2024-01-01T00:00:00Z",
            metadata={"version": "1.0"},
        )

        assert success is True
        assert error is None
        assert mock_client.post.called

        # Check request body
        call_args = mock_client.post.call_args
        import json

        body_str = call_args.kwargs.get("content")
        if isinstance(body_str, bytes):
            body_str = body_str.decode()
        body = json.loads(body_str)

        assert body["status"] == "healthy"
        assert body["sessionId"] == "123-abc"
        assert body["appName"] == "test-app"
        assert body["environment"] == "test"
        assert body["queueSize"] == 5

    def test_get_health(self):
        """get_health checks endpoint health."""
        mock_client = MagicMock(spec=httpx.Client)
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"status": "ok"}
        mock_client.get.return_value = mock_response

        transport = FathomTransport(
            api_key="sk_live_test",
            endpoint="https://api.example.com",
            http_client=mock_client,
        )

        success, error = transport.get_health()

        assert success is True
        assert error is None
        assert mock_client.get.called

        # Check URL
        call_args = mock_client.get.call_args
        url = call_args[0][0] if call_args[0] else call_args.kwargs.get("url")
        assert "/api/sdk/health" in url

    def test_content_type_header(self):
        """Requests include Content-Type: application/json."""
        mock_client = MagicMock(spec=httpx.Client)
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"ingested": 1}
        mock_client.post.return_value = mock_response

        transport = FathomTransport(
            api_key="sk_live_test",
            endpoint="https://api.example.com",
            http_client=mock_client,
        )

        events = [{"type": "test", "title": "Test", "severity": "info"}]
        transport.post_ingest(events)

        call_args = mock_client.post.call_args
        headers = call_args.kwargs.get("headers", {})
        assert headers.get("Content-Type") == "application/json"

    def test_auth_header_case_insensitive(self):
        """X-SDK-Key header is sent with proper capitalization."""
        mock_client = MagicMock(spec=httpx.Client)
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"ingested": 1}
        mock_client.post.return_value = mock_response

        transport = FathomTransport(
            api_key="sk_live_test",
            endpoint="https://api.example.com",
            http_client=mock_client,
        )

        events = [{"type": "test", "title": "Test", "severity": "info"}]
        transport.post_ingest(events)

        call_args = mock_client.post.call_args
        headers = call_args.kwargs.get("headers", {})

        # Check for capitalized version
        assert "X-SDK-Key" in headers
        assert headers["X-SDK-Key"] == "sk_live_test"
