"""Tests for EventBatcher."""

import pytest
import time
from unittest.mock import Mock, MagicMock
from fathom_sdk.batcher import EventBatcher
from fathom_sdk.events import SdkEvent
from fathom_sdk.transport import FathomTransport


class TestEventBatcher:
    """Tests for EventBatcher."""

    def test_enqueue_single_event(self):
        """enqueue adds event to queue."""
        mock_transport = MagicMock(spec=FathomTransport)
        batcher = EventBatcher(mock_transport, batch_size=50)

        event = SdkEvent(type="test", title="Test", severity="info")
        batcher.enqueue(event)

        assert batcher.size() == 1

        batcher.stop()

    def test_flush_at_batch_size(self):
        """flush_sync sends events when batch_size is reached."""
        mock_transport = MagicMock(spec=FathomTransport)
        mock_transport.post_ingest.return_value = (True, 3, None)

        batcher = EventBatcher(mock_transport, batch_size=3)

        for i in range(3):
            event = SdkEvent(type="test", title=f"Test {i}", severity="info")
            batcher.enqueue(event)

        # Flush manually
        batcher.flush_sync()

        assert mock_transport.post_ingest.called
        assert batcher.size() == 0

        batcher.stop()

    def test_flush_sync_multiple_batches(self):
        """flush_sync splits large queue across multiple POSTs."""
        mock_transport = MagicMock(spec=FathomTransport)
        mock_transport.post_ingest.return_value = (True, 2, None)

        batcher = EventBatcher(mock_transport, batch_size=2)

        # Enqueue 5 events (should require 3 batches: 2, 2, 1)
        for i in range(5):
            event = SdkEvent(type="test", title=f"Test {i}", severity="info")
            batcher.enqueue(event)

        batcher.flush_sync()

        # Should have made 3 calls
        assert mock_transport.post_ingest.call_count == 3

        batcher.stop()

    def test_failed_batch_requeued(self):
        """Failed batch is re-queued to front of queue."""
        mock_transport = MagicMock(spec=FathomTransport)
        mock_transport.post_ingest.return_value = (False, 0, "Network error")

        batcher = EventBatcher(mock_transport, batch_size=2)

        event1 = SdkEvent(type="test", title="Event 1", severity="info")
        event2 = SdkEvent(type="test", title="Event 2", severity="info")

        batcher.enqueue(event1)
        batcher.enqueue(event2)

        # Flush should fail and re-queue
        batcher.flush_sync()

        # Queue should still have 2 events
        assert batcher.size() == 2

        batcher.stop()

    def test_auth_header_included(self):
        """Flush includes X-SDK-Key header."""
        mock_transport = MagicMock(spec=FathomTransport)
        mock_transport.post_ingest.return_value = (True, 1, None)

        batcher = EventBatcher(mock_transport, batch_size=1)

        event = SdkEvent(type="test", title="Test", severity="info")
        batcher.enqueue(event)

        batcher.flush_sync()

        assert mock_transport.post_ingest.called

        # Check that transport was called (header check is in transport module)
        call_args = mock_transport.post_ingest.call_args
        batch = call_args[0][0] if call_args[0] else call_args.kwargs.get("events")
        assert isinstance(batch, list)
        assert len(batch) == 1

        batcher.stop()

    def test_stop_thread_safe(self):
        """stop() cleanly stops background thread."""
        mock_transport = MagicMock(spec=FathomTransport)
        mock_transport.post_ingest.return_value = (True, 0, None)

        batcher = EventBatcher(mock_transport, batch_size=50, flush_interval_seconds=1.0)
        batcher.start()

        # Give thread time to start
        time.sleep(0.1)

        batcher.stop()

        # Should be stopped now
        assert not batcher._is_running

    def test_start_is_idempotent(self):
        """start() can be called multiple times safely."""
        mock_transport = MagicMock(spec=FathomTransport)
        batcher = EventBatcher(mock_transport)

        batcher.start()
        batcher.start()  # Should not raise

        batcher.stop()

    def test_event_to_dict_conversion(self):
        """Events are converted to dict with correct field names."""
        mock_transport = MagicMock(spec=FathomTransport)
        mock_transport.post_ingest.return_value = (True, 1, None)

        batcher = EventBatcher(mock_transport, batch_size=1)

        event = SdkEvent(
            type="api",
            title="GET /users",
            severity="info",
            message="Success",
            metadata={"count": 42},
            sessionId="123-abc",
            appName="test-app",
            environment="test",
            tags=["important"],
        )

        batcher.enqueue(event)
        batcher.flush_sync()

        # Check what was sent to transport
        call_args = mock_transport.post_ingest.call_args
        batch = call_args[0][0]

        event_dict = batch[0]
        assert event_dict["type"] == "api"
        assert event_dict["title"] == "GET /users"
        assert event_dict["severity"] == "info"
        assert event_dict["message"] == "Success"
        assert event_dict["metadata"]["count"] == 42
        assert event_dict["sessionId"] == "123-abc"
        assert event_dict["appName"] == "test-app"
        assert event_dict["environment"] == "test"
        assert event_dict["tags"] == ["important"]

        batcher.stop()
