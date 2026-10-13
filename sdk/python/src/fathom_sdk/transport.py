"""HTTP transport layer for Fathom SDK with retry and backoff."""

import httpx
import json
import time
from typing import Optional, Dict, Any, Tuple
from enum import Enum


class RetryReason(Enum):
    """Reasons for retrying a request."""

    TRANSIENT_ERROR = "transient_error"
    SERVER_ERROR = "server_error"
    RATE_LIMITED = "rate_limited"


class FathomTransport:
    """HTTP transport with retry, backoff, and error handling.

    Retries on:
    - httpx.TransportError (network-level failures)
    - 5xx status codes
    - 429 (rate limit)

    Does NOT retry on 4xx (except 429).
    """

    def __init__(
        self,
        api_key: str,
        endpoint: str,
        http_client: Optional[httpx.Client] = None,
        timeout: float = 10.0,
        max_retries: int = 3,
        debug: bool = False,
    ):
        """Initialize transport.

        Args:
            api_key: SDK API key (sk_live_...)
            endpoint: Base endpoint URL
            http_client: Optional custom httpx.Client for testing
            timeout: Request timeout in seconds
            max_retries: Maximum retry attempts
            debug: Enable debug logging
        """
        self.api_key = api_key
        self.endpoint = endpoint.rstrip("/")
        self.timeout = timeout
        self.max_retries = max_retries
        self.debug = debug
        self.http_client = http_client

    def _log(self, message: str, **kwargs):
        """Debug logging."""
        if self.debug:
            print(f"[FATHOM Transport] {message}", kwargs)

    def _calculate_backoff(self, attempt: int) -> float:
        """Calculate exponential backoff with jitter.

        Formula: 200ms * 2^attempt + random jitter
        """
        import random

        base_delay = 0.2 * (2 ** attempt)
        jitter = random.uniform(0, base_delay * 0.1)
        return base_delay + jitter

    def _should_retry(self, status_code: int, attempt: int) -> Tuple[bool, Optional[RetryReason]]:
        """Determine if a request should be retried.

        Returns:
            (should_retry, reason)
        """
        if attempt >= self.max_retries:
            return False, None

        # Retry on 5xx
        if 500 <= status_code < 600:
            return True, RetryReason.SERVER_ERROR

        # Retry on 429 (rate limit)
        if status_code == 429:
            return True, RetryReason.RATE_LIMITED

        # Do not retry 4xx (except 429)
        if 400 <= status_code < 500:
            return False, None

        return False, None

    def post_ingest(self, events: list[Dict[str, Any]]) -> Tuple[bool, Optional[int], Optional[str]]:
        """POST events to /api/sdk/ingest.

        Args:
            events: List of event dictionaries

        Returns:
            (success, ingested_count, error_message)
        """
        url = f"{self.endpoint}/api/sdk/ingest"
        body = json.dumps({"events": events})
        headers = {
            "Content-Type": "application/json",
            "X-SDK-Key": self.api_key,
        }

        for attempt in range(self.max_retries + 1):
            try:
                self._log(f"POST {url} (attempt {attempt + 1})", events_count=len(events))

                if self.http_client:
                    # For testing: use injected client
                    response = self.http_client.post(
                        url,
                        content=body,
                        headers=headers,
                        timeout=self.timeout,
                    )
                else:
                    # Use module-level client
                    with httpx.Client(timeout=self.timeout) as client:
                        response = client.post(
                            url,
                            content=body,
                            headers=headers,
                        )

                if response.status_code == 200:
                    result = response.json()
                    ingested = result.get("ingested", 0)
                    self._log(f"Ingest success", ingested=ingested)
                    return True, ingested, None

                # Check if we should retry
                should_retry, reason = self._should_retry(response.status_code, attempt)
                if should_retry:
                    delay = self._calculate_backoff(attempt)
                    self._log(
                        f"Ingest failed with {response.status_code}, retrying in {delay:.2f}s",
                        reason=reason.value if reason else None,
                    )
                    time.sleep(delay)
                    continue

                # Non-retryable error (4xx except 429)
                error_msg = f"HTTP {response.status_code}: {response.text[:200]}"
                self._log(f"Ingest failed (non-retryable)", error=error_msg)
                return False, 0, error_msg

            except httpx.TransportError as e:
                if attempt < self.max_retries:
                    delay = self._calculate_backoff(attempt)
                    self._log(
                        f"Transport error, retrying in {delay:.2f}s",
                        error=str(e),
                    )
                    time.sleep(delay)
                    continue
                else:
                    error_msg = f"Transport error: {str(e)}"
                    self._log(f"Transport error (max retries exhausted)", error=str(e))
                    return False, 0, error_msg

        return False, 0, "Max retries exhausted"

    def post_heartbeat(
        self,
        status: str,
        session_id: str,
        app_name: str,
        environment: str,
        queue_size: int,
        timestamp: str,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Tuple[bool, Optional[str]]:
        """POST heartbeat to /api/sdk/heartbeat.

        Args:
            status: "healthy", "degraded", or "down"
            session_id: Session ID
            app_name: Application name
            environment: Environment name
            queue_size: Current queue size
            timestamp: ISO 8601 timestamp
            metadata: Optional metadata dict

        Returns:
            (success, error_message)
        """
        if metadata is None:
            metadata = {}

        url = f"{self.endpoint}/api/sdk/heartbeat"
        body = json.dumps(
            {
                "status": status,
                "sessionId": session_id,
                "appName": app_name,
                "environment": environment,
                "queueSize": queue_size,
                "timestamp": timestamp,
                "metadata": metadata,
            }
        )
        headers = {
            "Content-Type": "application/json",
            "X-SDK-Key": self.api_key,
        }

        try:
            self._log(f"POST {url}", status=status)

            if self.http_client:
                response = self.http_client.post(
                    url,
                    content=body,
                    headers=headers,
                    timeout=self.timeout,
                )
            else:
                with httpx.Client(timeout=self.timeout) as client:
                    response = client.post(
                        url,
                        content=body,
                        headers=headers,
                    )

            if response.status_code == 200:
                self._log("Heartbeat success")
                return True, None

            error_msg = f"HTTP {response.status_code}: {response.text[:200]}"
            self._log(f"Heartbeat failed", error=error_msg)
            return False, error_msg

        except httpx.TransportError as e:
            error_msg = f"Transport error: {str(e)}"
            self._log(f"Heartbeat transport error", error=str(e))
            return False, error_msg

    def get_health(self) -> Tuple[bool, Optional[str]]:
        """GET /api/sdk/health (public endpoint, no auth).

        Returns:
            (success, error_message)
        """
        url = f"{self.endpoint}/api/sdk/health"

        try:
            self._log(f"GET {url}")

            if self.http_client:
                response = self.http_client.get(url, timeout=self.timeout)
            else:
                with httpx.Client(timeout=self.timeout) as client:
                    response = client.get(url, timeout=self.timeout)

            if response.status_code == 200:
                self._log("Health check success")
                return True, None

            error_msg = f"HTTP {response.status_code}"
            self._log(f"Health check failed", error=error_msg)
            return False, error_msg

        except httpx.TransportError as e:
            error_msg = f"Transport error: {str(e)}"
            self._log(f"Health check transport error", error=str(e))
            return False, error_msg
