"""Event dataclasses for Fathom SDK."""

from dataclasses import dataclass, field, asdict
from typing import Optional, Dict, Any, List
from datetime import datetime
import json


@dataclass
class SdkEvent:
    """Represents a single SDK event.

    All fields match the backend wire format exactly (no snake_case conversion).
    Timestamps are ISO 8601 strings, set at event-creation time.
    """

    type: str
    title: str
    severity: str
    message: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)
    timestamp: Optional[str] = None
    sessionId: Optional[str] = None
    appName: Optional[str] = None
    environment: Optional[str] = None
    tags: Optional[List[str]] = None

    def __post_init__(self):
        """Validate event fields and set defaults."""
        if not self.type:
            raise ValueError("Event 'type' is required")
        if not self.title:
            raise ValueError("Event 'title' is required")
        if not self.severity:
            raise ValueError("Event 'severity' is required")

        valid_severities = {"debug", "info", "warning", "error", "critical"}
        if self.severity not in valid_severities:
            raise ValueError(
                f"Event 'severity' must be one of {valid_severities}, got {self.severity}"
            )

        # Timestamp defaults to now if not provided
        if self.timestamp is None:
            self.timestamp = datetime.utcnow().isoformat() + "Z"

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization (removing None values)."""
        result = {}
        for key, value in asdict(self).items():
            if value is not None:
                result[key] = value
        return result


def api_event(
    method: str,
    endpoint: str,
    status_code: int,
    duration_ms: int,
    *,
    metadata: Optional[Dict[str, Any]] = None,
) -> SdkEvent:
    """Create an API event with auto-severity mapping.

    Severity is set based on status code:
    - 500+: error
    - 400+: warning
    - else: info
    """
    if metadata is None:
        metadata = {}

    # Auto-map severity based on status code
    if status_code >= 500:
        severity = "error"
    elif status_code >= 400:
        severity = "warning"
    else:
        severity = "info"

    return SdkEvent(
        type="api",
        title=f"{method.upper()} {endpoint}",
        severity=severity,
        metadata={
            "method": method,
            "endpoint": endpoint,
            "statusCode": status_code,
            "durationMs": duration_ms,
            **metadata,
        },
    )


def error_event(
    exc_or_title: Optional[Exception | str] = None,
    *,
    title: Optional[str] = None,
    severity: str = "error",
    metadata: Optional[Dict[str, Any]] = None,
) -> SdkEvent:
    """Create an error event from an Exception or string.

    If an Exception is provided, captures:
    - name: exception class name
    - message: exception message
    - stack: full traceback
    """
    if metadata is None:
        metadata = {}

    error_metadata = {}

    if isinstance(exc_or_title, Exception):
        import traceback

        exc_name = type(exc_or_title).__name__
        exc_message = str(exc_or_title)
        error_metadata = {
            "name": exc_name,
            "message": exc_message,
            "stack": traceback.format_exc(),
        }
        # Title includes exception name for better visibility
        final_title = title or f"{exc_name}: {exc_message}" if exc_message else exc_name
    elif isinstance(exc_or_title, str):
        error_metadata = {"message": exc_or_title}
        final_title = title or exc_or_title
    else:
        final_title = title or "Error"

    return SdkEvent(
        type="error",
        title=final_title,
        severity=severity,
        metadata={**error_metadata, **metadata},
    )


def audit_event(
    title: str,
    *,
    message: Optional[str] = None,
    severity: str = "info",
    metadata: Optional[Dict[str, Any]] = None,
) -> SdkEvent:
    """Create an audit event."""
    if metadata is None:
        metadata = {}

    event_metadata = {}
    if message is not None:
        event_metadata["message"] = message

    return SdkEvent(
        type="audit",
        title=title,
        severity=severity,
        metadata={**event_metadata, **metadata},
    )


def metric_event(
    title: str,
    *,
    value: float | int,
    unit: str = "",
    metadata: Optional[Dict[str, Any]] = None,
) -> SdkEvent:
    """Create a metric event with value and unit."""
    if metadata is None:
        metadata = {}

    return SdkEvent(
        type="metric",
        title=title,
        severity="info",
        metadata={
            "value": value,
            "unit": unit,
            **metadata,
        },
    )
