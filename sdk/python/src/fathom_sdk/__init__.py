"""Fathom SDK — Lightweight Python SDK for observability."""

from ._version import __version__
from .client import FathomSDK
from .events import SdkEvent, api_event, error_event, audit_event, metric_event

__all__ = [
    "__version__",
    "FathomSDK",
    "SdkEvent",
    "api_event",
    "error_event",
    "audit_event",
    "metric_event",
]
