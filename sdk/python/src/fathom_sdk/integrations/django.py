"""Django middleware for Fathom SDK."""

from typing import Optional, Set, Callable
import time


class FathomDjangoMiddleware:
    """Middleware to auto-track HTTP requests in Django apps.

    Captures:
    - method, path, status_code, duration_ms
    - user_agent, client IP

    Skips health-check paths by default (configurable).

    Configuration via settings.FATHOM_SDK or pass sdk directly:
    """

    def __init__(
        self,
        get_response: Callable,
        sdk: Optional[object] = None,
        skip_paths: Optional[Set[str]] = None,
    ):
        """Initialize Django middleware.

        Args:
            get_response: Django get_response callable
            sdk: Optional FathomSDK instance. If None, read from Django settings.FATHOM_SDK
            skip_paths: Set of paths to skip
        """
        self.get_response = get_response

        # Get SDK from settings if not provided
        if sdk is None:
            try:
                from django.conf import settings

                sdk = getattr(settings, "FATHOM_SDK", None)
            except ImportError:
                sdk = None

        self.sdk = sdk

        # Default skip paths
        if skip_paths is None:
            skip_paths = {"/health", "/healthz", "/livez", "/readyz", "/metrics"}
        self.skip_paths = skip_paths

    def _should_skip(self, path: str) -> bool:
        """Check if path should be skipped."""
        return path in self.skip_paths

    def __call__(self, request):
        """Handle request and track via Fathom."""
        # Skip if SDK not configured
        if not self.sdk:
            return self.get_response(request)

        # Skip health-check paths
        if self._should_skip(request.path):
            return self.get_response(request)

        # Measure request
        start = time.time()
        response = self.get_response(request)
        duration_ms = (time.time() - start) * 1000

        # Extract metadata
        user_agent = request.META.get("HTTP_USER_AGENT", "unknown")
        client_ip = self._get_client_ip(request)

        # Track API call
        self.sdk.track_api(
            method=request.method,
            endpoint=request.path,
            status_code=response.status_code,
            duration_ms=duration_ms,
            metadata={
                "userAgent": user_agent,
                "ip": client_ip,
            },
        )

        return response

    @staticmethod
    def _get_client_ip(request) -> str:
        """Extract client IP from Django request.

        Checks X-Forwarded-For, X-Real-IP, then REMOTE_ADDR.
        """
        x_forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")
        if x_forwarded_for:
            return x_forwarded_for.split(",")[0].strip()

        x_real_ip = request.META.get("HTTP_X_REAL_IP")
        if x_real_ip:
            return x_real_ip.strip()

        return request.META.get("REMOTE_ADDR", "unknown")
