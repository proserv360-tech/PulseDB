"""Span Batcher for OTLP/HTTP ingest."""

import asyncio
import json
from typing import List, Optional
from .tracer import Span

try:
    from ._version import __version__ as _SDK_VERSION
except Exception:  # pragma: no cover - fallback if _version is unavailable
    _SDK_VERSION = "1.0.0"


class SpanBatcher:
    """Collects spans and flushes to /api/otlp/v1/traces."""

    def __init__(
        self,
        client,
        batch_size: int = 100,
        flush_interval_seconds: float = 10.0,
        debug: bool = False,
    ):
        """Initialize span batcher."""
        self.client = client
        self.batch_size = batch_size
        self.flush_interval_seconds = flush_interval_seconds
        self.debug = debug
        self.queue: List[Span] = []
        self.flush_task: Optional[asyncio.Task] = None
        self.is_shutting_down = False

    def enqueue(self, span: Span) -> None:
        """Add a span to the queue."""
        if self.is_shutting_down:
            return

        self.queue.append(span)

        # Auto-flush if queue exceeds batchSize
        if len(self.queue) >= self.batch_size:
            asyncio.create_task(self.flush())

    async def flush(self) -> None:
        """Flush all queued spans to OTLP endpoint."""
        if len(self.queue) == 0:
            return

        batch = self.queue[:self.batch_size]
        self.queue = self.queue[self.batch_size:]

        payload = self._build_otlp_payload(batch)

        try:
            import httpx
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.client.endpoint}/api/otlp/v1/traces",
                    json=payload,
                    headers={
                        'Content-Type': 'application/json',
                        'X-SDK-Key': self.client.api_key,
                    },
                    timeout=30.0,
                )

                if response.status_code != 200:
                    raise Exception(f"HTTP {response.status_code}: {response.text}")

                self._log(f"[Span Flush] Success ({len(batch)} spans)")
        except Exception as error:
            self._log(f"[ERROR] Span flush failed: {error}")
            # Re-queue spans on failure
            self.queue = batch + self.queue

    def _build_otlp_payload(self, spans: List[Span]) -> dict:
        """Build OTLP/HTTP payload from spans."""
        otlp_spans = [s.to_otlp_span() for s in spans]

        return {
            'resourceSpans': [
                {
                    'resource': {
                        'attributes': [
                            {'key': 'service.name', 'value': {'stringValue': self.client.app_name}},
                            {'key': 'service.version', 'value': {'stringValue': _SDK_VERSION}},
                        ],
                    },
                    'scopeSpans': [
                        {
                            'scope': {
                                'name': '@pulsedb/sdk',
                                'version': _SDK_VERSION,
                            },
                            'spans': otlp_spans,
                        },
                    ],
                },
            ],
        }

    async def shutdown(self) -> None:
        """Shutdown: flush remaining and cleanup."""
        self.is_shutting_down = True
        if len(self.queue) > 0:
            await self.flush()

    def _log(self, msg: str) -> None:
        """Debug logging."""
        if self.debug:
            print(f"[PulseDB] {msg}")

    def size(self) -> int:
        """Get current queue size."""
        return len(self.queue)
