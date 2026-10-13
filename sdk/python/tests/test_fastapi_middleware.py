"""Tests for FastAPI middleware."""

import pytest
from unittest.mock import MagicMock, Mock, AsyncMock, patch
from fathom_sdk.integrations.fastapi import FathomFastAPIMiddleware


class TestFastAPIMiddleware:
    """Tests for FathomFastAPIMiddleware."""

    @pytest.mark.asyncio
    async def test_middleware_tracks_api_call(self):
        """Middleware tracks API calls."""
        mock_sdk = MagicMock()
        mock_app = AsyncMock()
        mock_response = Mock()
        mock_response.status_code = 200
        mock_app.return_value = mock_response

        middleware = FathomFastAPIMiddleware(mock_app, sdk=mock_sdk)

        # Create mock request
        mock_request = Mock()
        mock_request.url.path = "/users"
        mock_request.method = "GET"
        mock_request.headers = {"user-agent": "test-agent"}
        mock_request.client = Mock(host="127.0.0.1")

        # Create mock call_next
        call_next = AsyncMock(return_value=mock_response)

        # Call middleware
        result = await middleware.dispatch(mock_request, call_next)

        # Check SDK was called
        assert mock_sdk.track_api.called
        call_args = mock_sdk.track_api.call_args

        assert call_args.kwargs["method"] == "GET"
        assert call_args.kwargs["endpoint"] == "/users"
        assert call_args.kwargs["status_code"] == 200
        assert "duration_ms" in call_args.kwargs

        # Check metadata
        metadata = call_args.kwargs.get("metadata", {})
        assert metadata.get("userAgent") == "test-agent"
        assert metadata.get("ip") == "127.0.0.1"

    @pytest.mark.asyncio
    async def test_middleware_skips_health_paths(self):
        """Middleware skips default health-check paths."""
        mock_sdk = MagicMock()
        mock_app = AsyncMock()
        mock_response = Mock()
        mock_app.return_value = mock_response

        middleware = FathomFastAPIMiddleware(mock_app, sdk=mock_sdk)

        # Test /health path
        mock_request = Mock()
        mock_request.url.path = "/health"
        mock_request.method = "GET"

        call_next = AsyncMock(return_value=mock_response)

        result = await middleware.dispatch(mock_request, call_next)

        # Should NOT track
        assert not mock_sdk.track_api.called

    @pytest.mark.asyncio
    async def test_middleware_custom_skip_paths(self):
        """Middleware can use custom skip paths."""
        mock_sdk = MagicMock()
        mock_app = AsyncMock()
        mock_response = Mock()
        mock_app.return_value = mock_response

        middleware = FathomFastAPIMiddleware(
            mock_app,
            sdk=mock_sdk,
            skip_paths={"/custom-health", "/internal"},
        )

        # Test custom path
        mock_request = Mock()
        mock_request.url.path = "/custom-health"
        mock_request.method = "GET"

        call_next = AsyncMock(return_value=mock_response)

        result = await middleware.dispatch(mock_request, call_next)

        # Should NOT track
        assert not mock_sdk.track_api.called

        # Now test non-skipped path
        mock_request.url.path = "/api/users"
        mock_sdk.reset_mock()

        result = await middleware.dispatch(mock_request, call_next)

        # Should track
        assert mock_sdk.track_api.called

    @pytest.mark.asyncio
    async def test_middleware_client_ip_handling(self):
        """Middleware extracts client IP from request."""
        mock_sdk = MagicMock()
        mock_app = AsyncMock()
        mock_response = Mock()
        mock_response.status_code = 200
        mock_app.return_value = mock_response

        middleware = FathomFastAPIMiddleware(mock_app, sdk=mock_sdk)

        # Test with no client
        mock_request = Mock()
        mock_request.url.path = "/users"
        mock_request.method = "GET"
        mock_request.headers = {"user-agent": "test"}
        mock_request.client = None

        call_next = AsyncMock(return_value=mock_response)

        result = await middleware.dispatch(mock_request, call_next)

        # Should use "unknown" for IP
        call_args = mock_sdk.track_api.call_args
        metadata = call_args.kwargs.get("metadata", {})
        assert metadata.get("ip") == "unknown"

    @pytest.mark.asyncio
    async def test_middleware_status_code_mapping(self):
        """Middleware captures correct status code."""
        mock_sdk = MagicMock()
        mock_app = AsyncMock()

        middleware = FathomFastAPIMiddleware(mock_app, sdk=mock_sdk)

        # Test 404
        mock_request = Mock()
        mock_request.url.path = "/notfound"
        mock_request.method = "GET"
        mock_request.headers = {}
        mock_request.client = Mock(host="127.0.0.1")

        mock_response = Mock()
        mock_response.status_code = 404

        call_next = AsyncMock(return_value=mock_response)

        result = await middleware.dispatch(mock_request, call_next)

        call_args = mock_sdk.track_api.call_args
        assert call_args.kwargs["status_code"] == 404

        # Test 500
        mock_sdk.reset_mock()
        mock_response.status_code = 500

        result = await middleware.dispatch(mock_request, call_next)

        call_args = mock_sdk.track_api.call_args
        assert call_args.kwargs["status_code"] == 500
