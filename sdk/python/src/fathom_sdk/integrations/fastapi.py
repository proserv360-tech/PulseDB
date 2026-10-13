"""FastAPI middleware for Fathom SDK."""

from typing import Optional, Set, Callable
import time
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response


class FathomFastAPIMiddleware(BaseHTTPMiddleware):
    """Middleware to auto-track HTTP requests in FastAPI apps.

    Captures:
    - method, path, status_code, duration_ms
    - user_agent, client IP

    Skips health-check paths by default (configurable).
    """

    def __init__(
        self,
        app,
        sdk,
        skip_paths: Optional[Set[str]] = None,
    ):
        """Initialize FastAPI middleware.

        Args:
            app: FastAPI app instance
            sdk: FathomSDK instance
            skip_paths: Set of paths to skip (e.g., "/health", "/metrics")
        """
        super().__init__(app)
        self.sdk = sdk

        # Default skip paths
        if skip_paths is None:
            skip_paths = {"/health", "/healthz", "/livez", "/readyz", "/metrics"}
        self.skip_paths = skip_paths

    def _should_skip(self, path: str) -> bool:
        """Check if path should be skipped."""
        return path in self.skip_paths

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """Handle request and track via Fathom."""
        # Skip health-check paths
        if self._should_skip(request.url.path):
            return await call_next(request)

        # Measure request
        start = time.time()
        response = await call_next(request)
        duration_ms = (time.time() - start) * 1000

        # Extract metadata
        user_agent = request.headers.get("user-agent", "unknown")
        client_ip = request.client.host if request.client else "unknown"

        # Track API call
        self.sdk.track_api(
            method=request.method,
            endpoint=request.url.path,
            status_code=response.status_code,
            duration_ms=duration_ms,
            metadata={
                "userAgent": user_agent,
                "ip": client_ip,
            },
        )

        return response
