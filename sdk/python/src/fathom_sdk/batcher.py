"""Thread-safe event batching and background flush."""

import threading
import time
from collections import deque
from typing import Optional, Callable
from .events import SdkEvent
from .transport import FathomTransport


class EventBatcher:
    """Thread-safe queue with background flush thread.

    Flushes when:
    1. Queue reaches batch_size events, OR
    2. flush_interval_seconds elapses

    Failed batches are re-queued to the FRONT of the queue.
    Flush thread wakes on condition variable (no busy-wait).
    """

    def __init__(
        self,
        transport: FathomTransport,
        batch_size: int = 50,
        flush_interval_seconds: float = 10.0,
        debug: bool = False,
    ):
        """Initialize batcher.

        Args:
            transport: FathomTransport instance
            batch_size: Number of events to batch
            flush_interval_seconds: Flush interval in seconds
            debug: Enable debug logging
        """
        self.transport = transport
        self.batch_size = batch_size
        self.flush_interval = flush_interval_seconds
        self.debug = debug

        # Thread-safe queue
        self.queue: deque[SdkEvent] = deque()
        self.lock = threading.RLock()
        self.condition = threading.Condition(self.lock)

        # Flush thread state
        self._flush_thread: Optional[threading.Thread] = None
        self._stop_event = threading.Event()
        self._is_running = False

    def _log(self, message: str, **kwargs):
        """Debug logging."""
        if self.debug:
            print(f"[FATHOM Batcher] {message}", kwargs)

    def enqueue(self, event: SdkEvent):
        """Add event to queue.

        Wakes flush thread if queue reaches batch_size.
        """
        with self.condition:
            self.queue.append(event)
            self._log(f"Event enqueued", queue_size=len(self.queue), batch_size=self.batch_size)

            # Wake flush thread if queue is full
            if len(self.queue) >= self.batch_size:
                self._log("Queue full, notifying flush thread")
                self.condition.notify()

    def _get_batch(self) -> list[dict]:
        """Extract up to batch_size events from front of queue.

        Caller must hold lock.
        """
        batch = []
        for _ in range(min(self.batch_size, len(self.queue))):
            event = self.queue.popleft()
            batch.append(event.to_dict())
        return batch

    def _requeue_failed_batch(self, batch: list[dict]):
        """Re-queue failed batch to front of queue.

        Caller must hold lock.
        """
        # Convert dicts back to events and prepend to queue
        for event_dict in reversed(batch):
            # Reconstruct event from dict
            self.queue.appendleft(
                SdkEvent(
                    type=event_dict.get("type"),
                    title=event_dict.get("title"),
                    severity=event_dict.get("severity"),
                    message=event_dict.get("message"),
                    metadata=event_dict.get("metadata", {}),
                    timestamp=event_dict.get("timestamp"),
                    sessionId=event_dict.get("sessionId"),
                    appName=event_dict.get("appName"),
                    environment=event_dict.get("environment"),
                    tags=event_dict.get("tags"),
                )
            )
        self._log("Failed batch re-queued", batch_size=len(batch), queue_size=len(self.queue))

    def flush_sync(self) -> int:
        """Synchronously flush all queued events.

        Splits large queue across multiple POSTs (one per batch_size).
        Returns total number of events flushed.
        """
        total_ingested = 0

        with self.condition:
            while len(self.queue) > 0:
                batch = self._get_batch()
                if not batch:
                    break

                self._log(f"Flushing batch", batch_size=len(batch))

                # Release lock during HTTP call
                self.condition.release()
                try:
                    success, ingested, error = self.transport.post_ingest(batch)
                    total_ingested += ingested if success else 0

                    if not success:
                        self._log(f"Batch flush failed, re-queueing", error=error)
                        # Re-acquire lock and requeue
                        self.condition.acquire()
                        self._requeue_failed_batch(batch)
                        # Break to avoid spinning on failed batches
                        break
                finally:
                    # Re-acquire lock
                    self.condition.acquire()

        self._log(f"Flush complete", total_ingested=total_ingested)
        return total_ingested

    def start(self):
        """Start background flush thread."""
        with self.condition:
            if self._is_running:
                self._log("Flush thread already running")
                return

            self._is_running = True
            self._stop_event.clear()

            self._flush_thread = threading.Thread(
                target=self._flush_loop,
                daemon=True,
                name="FathomFlushThread",
            )
            self._flush_thread.start()
            self._log("Flush thread started")

    def _flush_loop(self):
        """Background flush loop (runs in daemon thread)."""
        self._log("Flush loop started")

        while not self._stop_event.is_set():
            with self.condition:
                # Wait for either:
                # 1. Queue reaches batch_size, OR
                # 2. Flush interval elapses
                self._log("Waiting for flush condition", queue_size=len(self.queue))
                self.condition.wait(timeout=self.flush_interval)

                if self._stop_event.is_set():
                    break

                if len(self.queue) > 0:
                    self._log("Flushing on interval or batch size", queue_size=len(self.queue))
                    # Release lock during flush
                    self.condition.release()
                    try:
                        self.flush_sync()
                    finally:
                        self.condition.acquire()

        self._log("Flush loop exited")

    def stop(self):
        """Stop flush thread and return when complete.

        Safe to call multiple times.
        """
        with self.condition:
            if not self._is_running:
                self._log("Flush thread not running")
                return

            self._is_running = False
            self._stop_event.set()
            self._log("Stop signal sent to flush thread")
            self.condition.notify()

        # Wait for thread to join (outside lock to avoid deadlock)
        if self._flush_thread and threading.current_thread() != self._flush_thread:
            self._flush_thread.join(timeout=5.0)
            self._log("Flush thread joined")

    def size(self) -> int:
        """Get current queue size."""
        with self.lock:
            return len(self.queue)

    def size_unsafe(self) -> int:
        """Get queue size WITHOUT lock (use sparingly in already-locked contexts)."""
        return len(self.queue)
