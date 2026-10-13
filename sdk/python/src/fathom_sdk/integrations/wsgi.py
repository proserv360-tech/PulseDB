"""Generic WSGI middleware for Fathom SDK (Flask, etc.)."""

from typing import Optional, Set, Callable
import time


class FathomWSGIMiddleware:
    """Middleware to auto-track HTTP requests in WSGI apps (Flask, etc.).

    Captures:
    - method, path, status_code, duration_ms
    - user_agent, client IP

    Skips health-check paths by default (configurable).

    Usage in Flask:
        app = Flask(__name__)
        sdk = FathomSDK(...)
        app.wsgi_app = FathomWSGIMiddleware(app.wsgi_app, sdk)
    """

    def __init__(
        self,
        app: Callable,
        sdk: object,
        skip_paths: Optional[Set[str]] = None,
    ):
        """Initialize WSGI middleware.

        Args:
            app: WSGI app callable
            sdk: FathomSDK instance
            skip_paths: Set of paths to skip
        """
        self.app = app
        self.sdk = sdk

        # Default skip paths
        if skip_paths is None:
            skip_paths = {"/health", "/healthz", "/livez", "/readyz", "/metrics"}
        self.skip_paths = skip_paths

    def _should_skip(self, path: str) -> bool:
        """Check if path should be skipped."""
        return path in self.skip_paths

    def __call__(self, environ, start_response):
        """Handle WSGI request and track via Fathom."""
        method = environ.get("REQUEST_METHOD", "UNKNOWN")
        path = environ.get("PATH_INFO", "/")

        # Skip health-check paths
        if self._should_skip(path):
            return self.app(environ, start_response)

        # Measure request
        start = time.time()

        # Wrap start_response to capture status
        status_code = None

        def custom_start_response(status, response_headers, exc_info=None):
            nonlocal status_code
            # Status is like "200 OK"
            status_code = int(status.split()[0])
            return start_response(status, response_headers, exc_info)

        # Call app
        response = self.app(environ, custom_start_response)
        duration_ms = (time.time() - start) * 1000

        # Extract metadata
        user_agent = environ.get("HTTP_USER_AGENT", "unknown")
        client_ip = self._get_client_ip(environ)

        # Track API call
        if status_code is not None:
            self.sdk.track_api(
                method=method,
                endpoint=path,
                status_code=status_code,
                duration_ms=duration_ms,
                metadata={
                    "userAgent": user_agent,
                    "ip": client_ip,
                },
            )

        return response

    @staticmethod
    def _get_client_ip(environ) -> str:
        """Extract client IP from WSGI environ.

        Checks X-Forwarded-For, X-Real-IP, then REMOTE_ADDR.
        """
        x_forwarded_for = environ.get("HTTP_X_FORWARDED_FOR")
        if x_forwarded_for:
            return x_forwarded_for.split(",")[0].strip()

        x_real_ip = environ.get("HTTP_X_REAL_IP")
        if x_real_ip:
            return x_real_ip.strip()

        return environ.get("REMOTE_ADDR", "unknown")
