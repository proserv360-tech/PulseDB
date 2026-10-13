"""Tests for FathomSDK Tracer."""

import pytest
import asyncio
from unittest.mock import Mock, MagicMock, patch
from fathom_sdk.tracer import FathomTracer, Span, SpanKind, StatusCode, _active_span


class TestSpan:
    """Tests for Span class."""

    def test_span_creation(self):
        """Span is created with correct attributes."""
        span = Span(
            trace_id="trace123",
            span_id="span456",
            name="test-op",
            kind=SpanKind.INTERNAL,
        )

        assert span.trace_id == "trace123"
        assert span.span_id == "span456"
        assert span.name == "test-op"
        assert span.kind == SpanKind.INTERNAL
        assert span.ended is False
        assert span.status_code == StatusCode.UNSET

    def test_set_attribute(self):
        """set_attribute adds to attributes dict."""
        span = Span(trace_id="t1", span_id="s1", name="op")

        span.set_attribute("user.id", "u123")
        span.set_attribute("http.method", "GET")

        assert span.attributes["user.id"] == "u123"
        assert span.attributes["http.method"] == "GET"

    def test_record_exception(self):
        """record_exception captures exception details."""
        span = Span(trace_id="t1", span_id="s1", name="op")

        try:
            raise ValueError("Test error")
        except ValueError as exc:
            span.record_exception(exc)

        assert len(span.exceptions) == 1
        assert span.exceptions[0]["type"] == "ValueError"
        assert span.exceptions[0]["message"] == "Test error"
        assert "ValueError" in span.exceptions[0]["stacktrace"]

    def test_end_sets_status_and_time(self):
        """end() sets endTimeUnixNano and status."""
        span = Span(trace_id="t1", span_id="s1", name="op")

        assert span.end_time_unix_nano is None
        assert span.ended is False

        span.end(status="error")

        assert span.end_time_unix_nano is not None
        assert span.ended is True
        assert span.status_code == StatusCode.ERROR

    def test_end_idempotent(self):
        """end() is idempotent."""
        span = Span(trace_id="t1", span_id="s1", name="op")

        first_end_time = None
        span.end()
        first_end_time = span.end_time_unix_nano

        # Call end again
        span.end()

        assert span.end_time_unix_nano == first_end_time

    def test_context_manager(self):
        """Span works as context manager."""
        span = Span(trace_id="t1", span_id="s1", name="op")

        with span as s:
            s.set_attribute("test", "value")

        assert span.ended is True
        assert span.status_code == StatusCode.OK

    def test_context_manager_with_exception(self):
        """Span context manager records exception on error."""
        span = Span(trace_id="t1", span_id="s1", name="op")

        with pytest.raises(ValueError):
            with span as s:
                s.set_attribute("test", "value")
                raise ValueError("test error")

        assert span.ended is True
        assert span.status_code == StatusCode.ERROR
        assert len(span.exceptions) == 1
        assert span.exceptions[0]["type"] == "ValueError"

    def test_to_otlp_span(self):
        """to_otlp_span produces valid OTLP format."""
        span = Span(
            trace_id="trace123",
            span_id="span456",
            name="test-op",
            kind=SpanKind.SERVER,
            parent_span_id="parent789",
        )
        span.set_attribute("user.id", "u123")
        span.end(status="ok")

        otlp = span.to_otlp_span()

        assert otlp["traceId"] == "trace123"
        assert otlp["spanId"] == "span456"
        assert otlp["parentSpanId"] == "parent789"
        assert otlp["name"] == "test-op"
        assert otlp["kind"] == SpanKind.SERVER.value
        assert otlp["status"]["code"] == StatusCode.OK.value
        assert otlp["attributes"] is not None
        assert any(a["key"] == "user.id" for a in otlp["attributes"])


class TestFathomTracer:
    """Tests for FathomTracer."""

    def test_start_span(self):
        """start_span creates span with valid IDs."""
        mock_client = Mock()
        tracer = FathomTracer(mock_client)

        span = tracer.start_span(
            "test-op",
            attributes={"user.id": "u123"},
            kind=SpanKind.CLIENT,
        )

        assert span.name == "test-op"
        assert span.kind == SpanKind.CLIENT
        assert span.attributes["user.id"] == "u123"
        assert len(span.trace_id) == 32  # 16 bytes * 2 hex
        assert len(span.span_id) == 16   # 8 bytes * 2 hex

    def test_start_span_detects_parent(self):
        """start_span auto-detects parent span from context."""
        mock_client = Mock()
        tracer = FathomTracer(mock_client)

        parent_span = tracer.start_span("parent")
        token = _active_span.set(parent_span)

        try:
            child_span = tracer.start_span("child")

            assert child_span.parent_span_id == parent_span.span_id
            assert child_span.trace_id == parent_span.trace_id
        finally:
            _active_span.reset(token)

    def test_inject_headers(self):
        """inject_headers adds W3C traceparent."""
        mock_client = Mock()
        tracer = FathomTracer(mock_client)

        span = tracer.start_span("op")
        headers = {}

        tracer.inject_headers(headers, span)

        assert "traceparent" in headers
        assert headers["traceparent"].startswith("00-")
        parts = headers["traceparent"].split("-")
        assert len(parts) == 4
        assert parts[1] == span.trace_id
        assert parts[2] == span.span_id
        assert parts[3] == "01"

    def test_extract_context(self):
        """extract_context parses W3C traceparent."""
        mock_client = Mock()
        tracer = FathomTracer(mock_client)

        headers = {
            "traceparent": "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01"
        }

        ctx = tracer.extract_context(headers)

        assert ctx is not None
        assert ctx["traceId"] == "4bf92f3577b34da6a3ce929d0e0e4736"
        assert ctx["spanId"] == "00f067aa0ba902b7"
        assert ctx["flags"] == "01"

    def test_extract_context_missing(self):
        """extract_context returns None if traceparent missing."""
        mock_client = Mock()
        tracer = FathomTracer(mock_client)

        ctx = tracer.extract_context({})

        assert ctx is None

    def test_extract_context_invalid(self):
        """extract_context returns None for invalid format."""
        mock_client = Mock()
        tracer = FathomTracer(mock_client)

        ctx = tracer.extract_context({"traceparent": "invalid"})

        assert ctx is None


class TestWithSpan:
    """Tests for with_span context manager."""

    def test_with_span_sets_context(self):
        """with_span sets active span context."""
        mock_client = Mock()
        tracer = FathomTracer(mock_client)

        span = tracer.start_span("test-op")

        with tracer.with_span(span) as active_span:
            assert _active_span.get() == span

        # Context is cleared after exit
        assert _active_span.get() is None

    def test_with_span_nested(self):
        """with_span supports nesting."""
        mock_client = Mock()
        tracer = FathomTracer(mock_client)

        parent = tracer.start_span("parent")
        with tracer.with_span(parent):
            assert _active_span.get() == parent

            child = tracer.start_span("child")
            assert child.parent_span_id == parent.span_id

            with tracer.with_span(child):
                assert _active_span.get() == child

            assert _active_span.get() == parent

        assert _active_span.get() is None


class TestSpanAttributes:
    """Tests for span attribute serialization."""

    def test_attribute_value_string(self):
        """String attributes are serialized correctly."""
        span = Span(trace_id="t1", span_id="s1", name="op")
        span.set_attribute("key", "value")

        otlp = span.to_otlp_span()
        attr = next((a for a in otlp["attributes"] if a["key"] == "key"), None)

        assert attr is not None
        assert attr["value"]["stringValue"] == "value"

    def test_attribute_value_number(self):
        """Number attributes are serialized correctly."""
        span = Span(trace_id="t1", span_id="s1", name="op")
        span.set_attribute("int_key", 42)
        span.set_attribute("float_key", 3.14)

        otlp = span.to_otlp_span()
        attrs = {a["key"]: a["value"] for a in otlp["attributes"]}

        assert attrs["int_key"]["intValue"] == "42"
        assert attrs["float_key"]["doubleValue"] == 3.14

    def test_attribute_value_bool(self):
        """Boolean attributes are serialized correctly."""
        span = Span(trace_id="t1", span_id="s1", name="op")
        span.set_attribute("active", True)

        otlp = span.to_otlp_span()
        attr = next((a for a in otlp["attributes"] if a["key"] == "active"), None)

        assert attr["value"]["boolValue"] is True
