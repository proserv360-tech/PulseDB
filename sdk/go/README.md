# PulseDB Go SDK

Production-quality Go SDK for PulseDB observability platform. Zero external dependencies in the core module, with optional middleware for net/http and Gin.

## Features

- **Event Batching**: Automatic background batching with configurable size and flush interval
- **Exponential Backoff**: Intelligent retry with jittered exponential backoff (200ms \* 2^n)
- **Auto-Severity Mapping**: HTTP status codes automatically mapped to severity levels
- **Session Management**: Per-client-instance session IDs maintained for request tracing
- **Middleware Support**: Ready-to-use middleware for net/http and Gin frameworks
- **Thread-Safe**: Full concurrent support with goroutine-safe event queuing
- **Error Capture**: Automatic stack trace and error details capture
- **Type-Safe**: Strongly typed event constructors and configuration

## Installation

```bash
go get github.com/pulsedb/pulsedb-go
```

## Quick Start

### Basic Usage

```go
package main

import (
	"context"
	"log"
	"time"

	"github.com/pulsedb/pulsedb-go"
)

func main() {
	// Initialize the client
	client, err := pulsedb.New(pulsedb.Config{
		APIKey:      "sk_live_your_api_key",
		Endpoint:    "https://api.pulsedb.example.com",
		AppName:     "my-app",
		Environment: "production",
	})
	if err != nil {
		log.Fatal(err)
	}
	defer client.Shutdown(context.Background())

	// Track an API call
	client.TrackAPI("GET", "/api/users", 200, 125, nil)

	// Track an error
	err = someFunction()
	if err != nil {
		client.TrackError(err, map[string]interface{}{
			"context": "processing_payment",
		})
	}

	// Track an audit event
	client.TrackAudit("User Deleted", pulsedb.AuditOpts{
		Message: "User ID 123 deleted by admin",
		Severity: "info",
	})

	// Track a metric
	client.TrackMetric("Response Time", 145.2, "ms", nil)

	// Custom event
	client.Track("user_signup", "New User Registered", "info", map[string]interface{}{
		"source": "website",
	}, []string{"signup", "new_user"})

	// Send heartbeat
	client.Heartbeat(context.Background(), "healthy", nil)

	// Explicit flush (optional - batched automatically)
	client.Flush(context.Background())
}

func someFunction() error {
	return nil
}
```

### Net/HTTP Middleware

```go
package main

import (
	"log"
	"net/http"

	"github.com/pulsedb/pulsedb-go"
	"github.com/pulsedb/pulsedb-go/middleware/nethttp"
)

func main() {
	// Initialize PulseDB
	client, err := pulsedb.New(pulsedb.Config{
		APIKey:   "sk_live_your_api_key",
		Endpoint: "https://api.pulsedb.example.com",
		AppName:  "my-api",
	})
	if err != nil {
		log.Fatal(err)
	}
	defer client.Shutdown(nil)

	// Create your handler
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("Hello"))
	})

	// Wrap with PulseDB middleware
	wrappedHandler := nethttp.Middleware(client)(handler)

	// Use in your server
	http.ListenAndServe(":8080", wrappedHandler)
}
```

### Gin Middleware

```go
package main

import (
	"log"

	"github.com/pulsedb/pulsedb-go"
	"github.com/pulsedb/pulsedb-go/middleware/gin"
	"github.com/gin-gonic/gin"
)

func main() {
	// Initialize PulseDB
	client, err := pulsedb.New(pulsedb.Config{
		APIKey:   "sk_live_your_api_key",
		Endpoint: "https://api.pulsedb.example.com",
		AppName:  "my-api",
	})
	if err != nil {
		log.Fatal(err)
	}
	defer client.Shutdown(nil)

	// Create router
	router := gin.Default()

	// Use PulseDB middleware
	router.Use(gin.Middleware(client))

	// Define routes
	router.GET("/", func(c *gin.Context) {
		c.JSON(200, gin.H{"message": "Hello"})
	})

	router.Run(":8080")
}
```

## Configuration

```go
type Config struct {
	APIKey        string        // Required: SDK API key
	Endpoint      string        // Required: Base endpoint URL
	Environment   string        // Default: "production"
	AppName       string        // Default: "unnamed-app"
	BatchSize     int           // Default: 50
	FlushInterval time.Duration // Default: 10*time.Second
	Debug         bool          // Default: false
	HTTPClient    *http.Client  // Optional: override HTTP client
	Logger        Logger        // Optional: custom logger
}
```

## Event Types

### TrackAPI

Automatically maps HTTP status codes to severity:

- 500+: error
- 400+: warning
- else: info

```go
client.TrackAPI(method, endpoint, statusCode, durationMs, metadata)
```

### TrackError

Captures error type, message, and stack trace.

```go
client.TrackError(err, metadata)
// or with custom title/severity:
client.TrackErrorTitle(title, severity, metadata)
```

### TrackAudit

For audit logging.

```go
client.TrackAudit(title, pulsedb.AuditOpts{
	Message: "optional message",
	Severity: "info",
	Metadata: map[string]interface{}{...},
})
```

### TrackMetric

For numeric metrics.

```go
client.TrackMetric(title, value, unit, metadata)
```

### Track

For custom events.

```go
client.Track(eventType, title, severity, metadata, tags)
```

## Batcher Behavior

- Events are automatically queued in a background goroutine
- Flushing occurs when:
    - Queue reaches `BatchSize` events (default 50)
    - `FlushInterval` timer ticks (default 10 seconds)
    - Explicit `Flush()` or `Shutdown()` called
- Failed batches are re-queued at the front
- If queue exceeds 4x batch size, oldest events are dropped (bounded memory)
- Retries use exponential backoff: 200ms \* 2^n with 0-100ms jitter

## Error Handling

Transient errors (network errors, 5xx, 429) are retried with backoff.
Non-transient errors (4xx except 429) are logged and dropped.

## Thread Safety

The SDK is fully thread-safe. Events can be enqueued from multiple goroutines simultaneously.

## Shutdown

Always call `Shutdown()` to ensure all events are flushed:

```go
ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
defer cancel()
client.Shutdown(ctx)
```

## Testing

Run the test suite:

```bash
go test ./... -v -race
```

Examples are located in `examples/nethttp` and `examples/gin`.

## Wire Contract

- **Base URL**: Caller-supplied endpoint
- **Auth**: `X-SDK-Key` header with API key
- **Ingest**: `POST /api/sdk/ingest` with up to 100 events per request
- **Heartbeat**: `POST /api/sdk/heartbeat` for health checks
- **Health**: `GET /api/sdk/health` (public, no auth required)
- **Format**: JSON, no gzip
- **Max Events**: 100 per ingest request

## License

MIT
