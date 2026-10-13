# Fathom Python SDK

A lightweight, production-ready Python SDK for observability and event tracking with FATHOM.

## Features

- **Zero-overhead batching** — events are queued and flushed automatically
- **Thread-safe** — safe to use in multi-threaded applications
- **Auto-retry with backoff** — transient failures are retried with exponential backoff
- **Framework integrations** — built-in support for FastAPI, Django, and generic WSGI apps
- **Uncaught exception capture** — automatic hooks for system-level errors
- **Type-safe** — full Python type hints (PEP 561)

## Installation

```bash
pip install fathom-sdk
```

For optional framework support:

```bash
# FastAPI
pip install fathom-sdk[fastapi]

# Django
pip install fathom-sdk[django]

# Flask and other WSGI apps
pip install fathom-sdk[flask]
```

## Quick Start

### Basic Usage

```python
from fathom_sdk import FathomSDK

# Initialize SDK
sdk = FathomSDK(
    api_key="sk_live_your_key_here",
    endpoint="https://api.fathom.example.com",
    app_name="my-app",
    environment="production",
)

# Track API call
sdk.track_api(
    method="GET",
    endpoint="/users",
    status_code=200,
    duration_ms=42,
)

# Track error
try:
    result = risky_operation()
except Exception as e:
    sdk.track_error(e, metadata={"operation": "risky_operation"})

# Track custom metric
sdk.track_metric(
    title="ProcessingTime",
    value=1250,
    unit="ms",
)

# Track audit event
sdk.track_audit(
    title="User login",
    message="User alice logged in",
    metadata={"user_id": "123"},
)

# Send heartbeat (blocking)
sdk.heartbeat(status="healthy")

# Flush pending events (blocks until complete)
sdk.flush()

# Shutdown (flushes remaining events, stops background thread)
sdk.shutdown()
```

### Event Types

The SDK supports the following event types:

#### API Events

```python
sdk.track_api(
    method="POST",
    endpoint="/api/users",
    status_code=201,
    duration_ms=125,
    metadata={"user_count": 42}  # optional
)
```

Severity is auto-mapped:

- 500+: `error`
- 400+: `warning`
- else: `info`

#### Error Events

```python
try:
    divide_by_zero()
except ZeroDivisionError as e:
    sdk.track_error(
        e,
        severity="error",  # optional, default "error"
        metadata={"operation": "division"}
    )

# Or with a string
sdk.track_error("Something went wrong")
```

Exception details (name, message, traceback) are automatically captured.

#### Audit Events

```python
sdk.track_audit(
    title="User deleted",
    message="User alice (id=123) was deleted by admin",
    severity="warning",  # optional
    metadata={"deleted_by": "admin_user"}
)
```

#### Metrics

```python
sdk.track_metric(
    title="ResponseTime",
    value=250,
    unit="ms",
    metadata={"endpoint": "/api/users"}
)
```

#### Custom Events

```python
sdk.track(
    event_type="custom_event",
    title="MyCustomEvent",
    severity="info",
    message="Something interesting happened",
    tags=["important", "tracking"],
    metadata={"custom_field": "value"}
)
```

## Framework Integration

### FastAPI

```python
from fastapi import FastAPI
from fathom_sdk import FathomSDK
from fathom_sdk.integrations.fastapi import FathomFastAPIMiddleware

sdk = FathomSDK(
    api_key="sk_live_xxx",
    endpoint="https://api.fathom.example.com",
)

app = FastAPI()
app.add_middleware(FathomFastAPIMiddleware, sdk=sdk)

# Now all HTTP requests are automatically tracked
```

The middleware captures:

- HTTP method, path, status code, duration
- User-Agent and client IP
- Skips health-check endpoints by default (`/health`, `/metrics`, etc.)

Custom skip paths:

```python
app.add_middleware(
    FathomFastAPIMiddleware,
    sdk=sdk,
    skip_paths={"/health", "/readyz", "/custom-endpoint"}
)
```

### Django

Add to `settings.py`:

```python
INSTALLED_APPS = [
    # ...
]

MIDDLEWARE = [
    # ... other middleware ...
    "fathom_sdk.integrations.django.FathomDjangoMiddleware",
]

# Optional: configure SDK via settings
from fathom_sdk import FathomSDK

FATHOM_SDK = FathomSDK(
    api_key="sk_live_xxx",
    endpoint="https://api.fathom.example.com",
    app_name="my-django-app",
)
```

Or pass SDK directly to middleware in `wsgi.py`:

```python
from django.core.wsgi import get_wsgi_application
from fathom_sdk import FathomSDK
from fathom_sdk.integrations.django import FathomDjangoMiddleware

sdk = FathomSDK(...)
application = FathomDjangoMiddleware(get_wsgi_application(), sdk=sdk)
```

### Flask / WSGI

```python
from flask import Flask
from fathom_sdk import FathomSDK
from fathom_sdk.integrations.wsgi import FathomWSGIMiddleware

sdk = FathomSDK(
    api_key="sk_live_xxx",
    endpoint="https://api.fathom.example.com",
)

app = Flask(__name__)
app.wsgi_app = FathomWSGIMiddleware(app.wsgi_app, sdk=sdk)

# Now all requests are tracked
```

## Uncaught Exception Capture

Install global exception hooks to automatically track uncaught exceptions:

```python
sdk.capture_uncaught_exceptions()

# Now any uncaught exception will be tracked with severity="critical"
# and the SDK will flush before the program exits
```

This captures:

- Uncaught exceptions in the main thread via `sys.excepthook`
- Uncaught exceptions in other threads via `threading.excepthook` (Python 3.8+)

## Configuration

```python
sdk = FathomSDK(
    api_key="sk_live_...",
    endpoint="https://api.fathom.example.com",

    # Optional:
    app_name="my-app",              # default: "unnamed-app"
    environment="production",        # default: "production"
    batch_size=50,                  # events per batch (default: 50)
    flush_interval_seconds=10.0,    # auto-flush interval (default: 10)
    debug=False,                    # enable debug logging (default: False)
    http_client=None,               # inject custom httpx.Client (testing)
)
```

### Batching

- Events are queued in memory
- Queue flushes when:
    1. It reaches `batch_size`, OR
    2. `flush_interval_seconds` elapses (whichever comes first)
- Failed batches are re-queued to the front of the queue (not retried immediately)

### Retry Strategy

Transient errors are retried up to 3 times with exponential backoff:

- Formula: `200ms * 2^attempt + random jitter`
- Retried on: network errors, 5xx, 429 (rate limit)
- NOT retried on: 4xx (except 429)

## Lifecycle

```python
# Initialize
sdk = FathomSDK(...)

# Use SDK
sdk.track_api(...)
sdk.track_error(...)
# ... more tracking ...

# Explicit flush (optional)
sdk.flush()

# Shutdown (flushes remaining events, stops background thread)
sdk.shutdown()

# Safe to call multiple times
sdk.shutdown()
```

The SDK registers an `atexit` handler, so `shutdown()` is called automatically on program exit.

## Testing

The SDK is designed for testability:

```python
import httpx
from unittest.mock import MagicMock
from fathom_sdk import FathomSDK

# Mock HTTP client
mock_http = MagicMock(spec=httpx.Client)
mock_http.post.return_value = Mock(status_code=200, json=lambda: {"ingested": 1})

# Inject mock client
sdk = FathomSDK(
    api_key="sk_live_test",
    endpoint="https://api.test.com",
    http_client=mock_http,  # custom client
)

# Track events
sdk.track_api("GET", "/users", 200, 42)

# Flush triggers HTTP call
sdk.flush()

# Verify
assert mock_http.post.called
```

## Running Tests

```bash
# Install test dependencies
pip install -e ".[dev]"

# Run tests
pytest tests/ -v

# Run with coverage
pytest tests/ --cov=fathom_sdk
```

## Example Application

See `examples/fastapi_app.py` for a complete FastAPI example:

```bash
cd sdk/python

# Install dependencies
pip install -e ".[fastapi]"

# Run example (make sure FATHOM backend is running on http://localhost:5000)
python examples/fastapi_app.py

# In another terminal, test it:
curl http://localhost:8000/
curl http://localhost:8000/users/42
curl -X POST "http://localhost:8000/users?name=Alice"
```

## Wire Protocol

The SDK implements the FATHOM wire contract:

### Events Endpoint

```
POST /api/sdk/ingest
Content-Type: application/json
X-SDK-Key: sk_live_<key>

{
  "events": [
    {
      "type": "api|error|audit|metric|<custom>",
      "title": "string",
      "severity": "debug|info|warning|error|critical",
      "message": "string or null",
      "metadata": { /* object */ },
      "timestamp": "ISO 8601",
      "sessionId": "<millis>-<8-hex-rand>",
      "appName": "string",
      "environment": "string",
      "tags": ["string"] or null
    }
  ]
}

Response: { "ingested": <int> }
```

Max 100 events per request.

### Heartbeat Endpoint

```
POST /api/sdk/heartbeat
Content-Type: application/json
X-SDK-Key: sk_live_<key>

{
  "status": "healthy|degraded|down",
  "sessionId": "string",
  "appName": "string",
  "environment": "string",
  "queueSize": <int>,
  "timestamp": "ISO 8601",
  "metadata": { /* object */ }
}

Response: { "acknowledged": true }
```

### Health Endpoint

```
GET /api/sdk/health

Response: { "status": "ok", "version": "1.0.0", "timestamp": "ISO 8601" }
```

## License

MIT — See LICENSE file.

## Support

For issues, features, or questions, contact the FATHOM team.
