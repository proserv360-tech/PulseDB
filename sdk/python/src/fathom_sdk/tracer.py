"""Distributed Tracing (OTLP/HTTP) for FathomSDK."""

import secrets
import time
import traceback
from contextvars import ContextVar
from datetime import datetime
from enum import Enum
from typing import Optional, Dict, Any, List
from dataclasses import dataclass, field

# Context variable for active span (thread-safe + async-safe)
_active_span: ContextVar[Optional['Span']] = ContextVar('active_span', default=None)


class SpanKind(Enum):
    """OTLP span kind."""
    INTERNAL = 1
    SERVER = 2
    CLIENT = 3
    PRODUCER = 4
    CONSUMER = 5


class StatusCode(Enum):
    """OTLP status code."""
    UNSET = 0
    OK = 1
    ERROR = 2


@dataclass
class Span:
    """Represents a single span in a trace."""
    trace_id: str
    span_id: str
    name: str
    kind: SpanKind = SpanKind.INTERNAL
    parent_span_id: Optional[str] = None
    attributes: Dict[str, Any] = field(default_factory=dict)
    exceptions: List[Dict[str, str]] = field(default_factory=list)
    start_time_unix_nano: int = field(default_factory=lambda: int(time.time() * 1e9))
    end_time_unix_nano: Optional[int] = None
    status_code: StatusCode = StatusCode.UNSET
    status_message: str = ''
    ended: bool = False

    def set_attribute(self, key: str, value: Any) -> None:
        """Set a span attribute."""
        if not self.ended:
            self.attributes[key] = value

    def record_exception(self, exc: Exception) -> None:
        """Record an exception."""
        if not self.ended:
            import sys

            # Get traceback from the exception
            tb_str = ''
            if exc.__traceback__ is not None:
                tb_str = ''.join(traceback.format_exception(type(exc), exc, exc.__traceback__))
            else:
                tb_str = str(exc)

            exc_dict = {
                'type': type(exc).__name__,
                'message': str(exc),
                'stacktrace': tb_str,
            }
            self.exceptions.append(exc_dict)

    def end(self, status: Optional[str] = None) -> None:
        """End the span."""
        if self.ended:
            return
        self.ended = True
        self.end_time_unix_nano = int(time.time() * 1e9)
        if status:
            self.status_code = StatusCode.ERROR if status.lower() == 'error' else StatusCode.OK

    def __enter__(self):
        """Context manager entry."""
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit."""
        if exc_type:
            self.record_exception(exc_val)
            self.end(status='error')
        else:
            self.end(status='ok')

    def to_otlp_span(self) -> Dict[str, Any]:
        """Convert span to OTLP format."""
        attributes = []
        for key, value in self.attributes.items():
            attributes.append({
                'key': key,
                'value': self._attribute_value(value),
            })

        # Add exception attributes if any
        if self.exceptions:
            exc = self.exceptions[0]
            attributes.append({'key': 'exception.type', 'value': {'stringValue': exc['type']}})
            attributes.append({'key': 'exception.message', 'value': {'stringValue': exc['message']}})
            attributes.append({'key': 'exception.stacktrace', 'value': {'stringValue': exc['stacktrace']}})

        otlp_span = {
            'traceId': self.trace_id,
            'spanId': self.span_id,
            'name': self.name,
            'kind': self.kind.value,
            'startTimeUnixNano': str(self.start_time_unix_nano),
            'endTimeUnixNano': str(self.end_time_unix_nano) if self.end_time_unix_nano else '',
            'attributes': attributes if attributes else None,
            'status': {
                'code': self.status_code.value,
                'message': self.status_message,
            },
        }

        if self.parent_span_id:
            otlp_span['parentSpanId'] = self.parent_span_id

        return otlp_span

    @staticmethod
    def _attribute_value(value: Any) -> Dict[str, Any]:
        """Convert attribute value to OTLP format."""
        if isinstance(value, str):
            return {'stringValue': value}
        if isinstance(value, bool):
            return {'boolValue': value}
        if isinstance(value, int):
            return {'intValue': str(value)}
        if isinstance(value, float):
            return {'doubleValue': value}
        return {'stringValue': str(value)}


class FathomTracer:
    """Main tracer interface for FathomSDK."""

    def __init__(self, client):
        """Initialize tracer."""
        self.client = client
        self.span_batcher = None

    def start_span(
        self,
        name: str,
        *,
        attributes: Optional[Dict[str, Any]] = None,
        kind: SpanKind = SpanKind.INTERNAL,
    ) -> Span:
        """Start a new span with automatic parent context detection."""
        if attributes is None:
            attributes = {}

        # Detect parent span from context
        parent_span = _active_span.get()

        # Inherit trace ID from parent, or generate new one
        if parent_span:
            trace_id = parent_span.trace_id
            parent_span_id = parent_span.span_id
        else:
            trace_id = secrets.token_hex(16)
            parent_span_id = None

        # Always generate new span ID
        span_id = secrets.token_hex(8)

        # Create span
        span = Span(
            trace_id=trace_id,
            span_id=span_id,
            name=name,
            kind=kind,
            parent_span_id=parent_span_id,
        )

        for key, value in attributes.items():
            span.set_attribute(key, value)

        return span

    def with_span(self, span: Span):
        """Context manager for executing code with span as active context."""
        class SpanContextManager:
            def __init__(self, span, tracer):
                self.span = span
                self.tracer = tracer
                self.token = None

            def __enter__(self):
                self.token = _active_span.set(self.span)
                return self.span

            def __exit__(self, exc_type, exc_val, exc_tb):
                _active_span.reset(self.token)
                if exc_type:
                    self.span.record_exception(exc_val)
                    self.span.end(status='error')
                else:
                    self.span.end(status='ok')

        return SpanContextManager(span, self)

    def inject_headers(self, headers: Dict[str, str], span: Optional[Span] = None) -> None:
        """Inject W3C traceparent header."""
        if not span:
            return
        # Format: 00-<trace>-<span>-01
        traceparent = f"00-{span.trace_id}-{span.span_id}-01"
        headers['traceparent'] = traceparent

    def extract_context(self, headers: Dict[str, str]) -> Optional[Dict[str, str]]:
        """Extract trace context from W3C traceparent header."""
        traceparent = headers.get('traceparent') or headers.get('Traceparent')
        if not traceparent:
            return None

        parts = traceparent.split('-')
        if len(parts) != 4 or parts[0] != '00':
            return None

        return {
            'traceId': parts[1],
            'spanId': parts[2],
            'flags': parts[3],
        }

    def register_batcher(self, batcher):
        """Register span batcher (called by client)."""
        self.span_batcher = batcher

    async def flush(self):
        """Flush all pending spans."""
        if self.span_batcher:
            await self.span_batcher.flush()
