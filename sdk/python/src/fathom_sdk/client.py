"""Main FathomSDK client."""

import sys
import threading
import atexit
from datetime import datetime, timezone
from typing import Optional, Dict, Any
from .events import (
    SdkEvent,
    api_event,
    error_event,
    audit_event,
    metric_event,
)
from .transport import FathomTransport
from .batcher import EventBatcher
from .tracer import FathomTracer, SpanKind
from .span_batcher import SpanBatcher


class FathomSDK:
    """Production-quality Fathom SDK client.

    Wire contract matches JS SDK exactly:
    - Base URL: caller-supplied endpoint
    - Auth header: X-SDK-Key
    - POST /api/sdk/ingest with batched events
    - POST /api/sdk/heartbeat for health
    - GET /api/sdk/health (public)

    Includes:
    - Thread-safe event batching with background flush
    - Exponential backoff + jitter on transient failures
    - Auto-severity mapping for API calls
    - Exception capture with full stack traces
    - Uncaught exception hooks (Python + threading)
    """

    def __init__(
        self,
        api_key: str,
        endpoint: str,
        *,
        environment: str = "production",
        app_name: str = "unnamed-app",
        batch_size: int = 50,
        flush_interval_seconds: float = 10.0,
        debug: bool = False,
        http_client: Optional[Any] = None,
    ):
        """Initialize FathomSDK client.

        Args:
            api_key: SDK API key (sk_live_...)
            endpoint: Base endpoint URL
            environment: Environment name
            app_name: Application name
            batch_size: Events per batch
            flush_interval_seconds: Flush interval in seconds
            debug: Enable debug logging
            http_client: Optional injected httpx.Client (for testing)

        Raises:
            ValueError: If api_key or endpoint is missing
        """
        if not api_key:
            raise ValueError("[FATHOM SDK] api_key is required (e.g., sk_live_xxx)")
        if not endpoint:
            raise ValueError("[FATHOM SDK] endpoint is required (e.g., https://fathom.example.com)")

        self.api_key = api_key
        self.endpoint = endpoint.rstrip("/")
        self.environment = environment
        self.app_name = app_name
        self.batch_size = batch_size
        self.flush_interval_seconds = flush_interval_seconds
        self.debug = debug

        # Session ID: <millis>-<8-hex-rand>
        self.session_id = self._generate_session_id()

        # Transport and batcher
        self.transport = FathomTransport(
            api_key=api_key,
            endpoint=self.endpoint,
            http_client=http_client,
            debug=debug,
        )
        self.batcher = EventBatcher(
            transport=self.transport,
            batch_size=batch_size,
            flush_interval_seconds=flush_interval_seconds,
            debug=debug,
        )

        # Start flush thread
        self.batcher.start()

        # Initialize tracing
        self.tracing = FathomTracer(self)
        self.span_batcher = SpanBatcher(
            client=self,
            batch_size=batch_size,
            flush_interval_seconds=flush_interval_seconds,
            debug=debug,
        )
        self.tracing.register_batcher(self.span_batcher)

        # Track if shutting down
        self._is_shutting_down = False

        # Register atexit handler
        atexit.register(self.shutdown)

        self._log(
            "[SDK initialized]",
            endpoint=self.endpoint,
            appName=self.app_name,
            environment=self.environment,
        )

    def _log(self, *args, **kwargs):
        """Debug logging."""
        if self.debug:
            print("[FATHOM]", *args, kwargs)

    def _generate_session_id(self) -> str:
        """Generate session ID: <millis>-<8-hex-rand>."""
        import time
        import secrets

        millis = int(time.time() * 1000)
        rand_hex = secrets.token_hex(4)  # 8 hex chars
        return f"{millis}-{rand_hex}"

    def _enqueue(self, event: SdkEvent):
        """Add event to queue with session context.

        If SDK is shutting down, drops event with warning.
        """
        if self._is_shutting_down:
            self._log("[WARN] SDK is shutting down, event dropped:", event.type)
            return

        # Inject session context
        event.sessionId = self.session_id
        event.appName = self.app_name
        event.environment = self.environment

        self.batcher.enqueue(event)

    def track_api(
        self,
        method: str,
        endpoint: str,
        status_code: int,
        duration_ms: int,
        *,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> None:
        """Track an API call.

        Severity is auto-mapped:
        - 500+: error
        - 400+: warning
        - else: info

        Args:
            method: HTTP method
            endpoint: Request path/URL
            status_code: HTTP status code
            duration_ms: Request duration in milliseconds
            metadata: Optional metadata dict
        """
        if metadata is None:
            metadata = {}

        event = api_event(
            method=method,
            endpoint=endpoint,
            status_code=status_code,
            duration_ms=duration_ms,
            metadata=metadata,
        )
        self._enqueue(event)

    def track_error(
        self,
        exc_or_title: Optional[Exception | str] = None,
        *,
        severity: str = "error",
        metadata: Optional[Dict[str, Any]] = None,
    ) -> None:
        """Track an error.

        If an Exception is provided, captures:
        - name: exception class name
        - message: exception message
        - stack: full traceback

        Args:
            exc_or_title: Exception or error title string
            severity: Error severity
            metadata: Optional metadata dict
        """
        if metadata is None:
            metadata = {}

        event = error_event(
            exc_or_title=exc_or_title,
            severity=severity,
            metadata=metadata,
        )
        self._enqueue(event)

    def track_audit(
        self,
        title: str,
        *,
        message: Optional[str] = None,
        severity: str = "info",
        metadata: Optional[Dict[str, Any]] = None,
    ) -> None:
        """Track an audit event.

        Args:
            title: Event title
            message: Optional message
            severity: Event severity
            metadata: Optional metadata dict
        """
        if metadata is None:
            metadata = {}

        event = audit_event(
            title=title,
            message=message,
            severity=severity,
            metadata=metadata,
        )
        self._enqueue(event)

    def track_metric(
        self,
        title: str,
        *,
        value: float | int,
        unit: str = "",
        metadata: Optional[Dict[str, Any]] = None,
    ) -> None:
        """Track a metric.

        Args:
            title: Metric name
            value: Metric value
            unit: Metric unit (e.g., "ms", "bytes")
            metadata: Optional metadata dict
        """
        if metadata is None:
            metadata = {}

        event = metric_event(
            title=title,
            value=value,
            unit=unit,
            metadata=metadata,
        )
        self._enqueue(event)

    def track(
        self,
        event_type: str,
        *,
        title: str,
        severity: str = "info",
        message: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
        tags: Optional[list[str]] = None,
    ) -> None:
        """Track a custom event.

        Args:
            event_type: Custom event type
            title: Event title
            severity: Event severity
            message: Optional message
            metadata: Optional metadata dict
            tags: Optional list of tags
        """
        if metadata is None:
            metadata = {}
        if tags is None:
            tags = []

        event = SdkEvent(
            type=event_type,
            title=title,
            severity=severity,
            message=message,
            metadata={
                "tags": tags,
                **metadata,
            },
        )
        self._enqueue(event)

    def heartbeat(
        self,
        status: str = "healthy",
        *,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> bool:
        """Send a heartbeat (blocking).

        Args:
            status: "healthy", "degraded", or "down"
            metadata: Optional metadata dict

        Returns:
            True if successful, False otherwise
        """
        if metadata is None:
            metadata = {}

        timestamp = datetime.now(timezone.utc).isoformat()
        success, error = self.transport.post_heartbeat(
            status=status,
            session_id=self.session_id,
            app_name=self.app_name,
            environment=self.environment,
            queue_size=self.batcher.size(),
            timestamp=timestamp,
            metadata=metadata,
        )

        if success:
            self._log("[Heartbeat] Success")
        else:
            self._log("[WARN] Heartbeat failed:", error)

        return success

    def health(self) -> bool:
        """Check health of Fathom endpoint (blocking).

        Returns:
            True if healthy, False otherwise
        """
        success, error = self.transport.get_health()
        if success:
            self._log("[Health] OK")
        else:
            self._log("[WARN] Health check failed:", error)
        return success

    def flush(self) -> None:
        """Synchronously drain queue and flush all events.

        Blocks until all HTTP calls complete.
        """
        self._log("[Flush] Starting synchronous flush")
        self.batcher.flush_sync()
        self._log("[Flush] Complete")

    def shutdown(self) -> None:
        """Flush remaining events and stop flush thread.

        Safe to call multiple times (idempotent).
        """
        if self._is_shutting_down:
            return

        self._log("[Shutdown] Initiating SDK shutdown...")
        self._is_shutting_down = True

        # Stop background flush thread
        self.batcher.stop()

        # Flush any remaining events
        if self.batcher.size() > 0:
            self._log("[Shutdown] Flushing remaining events")
            self.flush()

        # Flush any remaining spans. span_batcher.flush()/shutdown() are async,
        # so drain them on a dedicated event loop from this sync context.
        if self.span_batcher.size() > 0:
            self._log("[Shutdown] Flushing remaining spans")
            self._drain_spans_sync()

        self._log("[Shutdown] Complete")

    def _drain_spans_sync(self) -> None:
        """Synchronously flush the span batcher from a non-async context.

        Runs span_batcher.shutdown() to completion. If an event loop is already
        running in this thread (rare during shutdown), drains on a worker thread
        to avoid 'event loop already running' errors.
        """
        try:
            try:
                running_loop = asyncio.get_running_loop()
            except RuntimeError:
                running_loop = None

            if running_loop is None:
                asyncio.run(self.span_batcher.shutdown())
            else:
                # An event loop is already running; run the coroutine to
                # completion on a separate thread with its own loop.
                import threading

                def _runner():
                    asyncio.run(self.span_batcher.shutdown())

                t = threading.Thread(target=_runner, daemon=True)
                t.start()
                t.join(timeout=self.transport.timeout + 1.0)
        except Exception as error:
            self._log("[WARN] Span drain failed:", error)

    def capture_uncaught_exceptions(self) -> None:
        """Install exception hooks for uncaught exceptions and unhandled rejections.

        Hooks:
        - sys.excepthook: uncaught exceptions in main thread
        - threading.excepthook: uncaught exceptions in other threads
        """
        original_excepthook = sys.excepthook

        def custom_excepthook(exc_type, exc_value, exc_traceback):
            """Custom exception hook."""
            self.track_error(
                exc_or_title=exc_value,
                severity="critical",
                metadata={"type": "uncaughtException"},
            )
            self.flush()
            # Call original hook
            original_excepthook(exc_type, exc_value, exc_traceback)

        sys.excepthook = custom_excepthook

        # Also set threading.excepthook (Python 3.8+)
        if hasattr(threading, "excepthook"):
            original_threading_excepthook = threading.excepthook

            def custom_threading_excepthook(args):
                """Custom threading exception hook."""
                exc_value = args.exc_value
                self.track_error(
                    exc_or_title=exc_value,
                    severity="critical",
                    metadata={"type": "uncaughtException", "threadName": args.thread.name},
                )
                # Note: don't flush from thread context, just queue
                # Call original hook
                original_threading_excepthook(args)

            threading.excepthook = custom_threading_excepthook

        self._log("[SDK] Uncaught exception handlers installed")
