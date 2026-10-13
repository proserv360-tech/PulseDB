package pulsedb

import (
	"context"
	"fmt"
	"net/http"
	"sync/atomic"
	"time"
)

// Logger interface for custom logging
type Logger interface {
	Debugf(format string, args ...interface{})
	Infof(format string, args ...interface{})
	Warnf(format string, args ...interface{})
	Errorf(format string, args ...interface{})
}

// Config holds SDK configuration
type Config struct {
	APIKey        string        // Required: SDK API key (sk_live_...)
	Endpoint      string        // Required: Base endpoint URL
	Environment   string        // Default: "production"
	AppName       string        // Default: "unnamed-app"
	BatchSize     int           // Default: 50
	FlushInterval time.Duration // Default: 10*time.Second
	Debug         bool
	HTTPClient    *http.Client // Optional override
	Logger        Logger       // Optional custom logger
}

// Client is the main SDK client
type Client struct {
	config         Config
	sessionID      string
	batcher        *Batcher
	transport      *Transport
	logger         Logger
	isShuttingDown atomic.Bool
	Tracing        *Tracer
	spanBatcher    *SpanBatcher
}

// New creates and initializes a new PulseDB SDK client
func New(cfg Config) (*Client, error) {
	// Validate required fields
	if cfg.APIKey == "" {
		return nil, fmt.Errorf("[PulseDB SDK] apiKey is required (e.g., sk_live_xxx)")
	}
	if cfg.Endpoint == "" {
		return nil, fmt.Errorf("[PulseDB SDK] endpoint is required (e.g., https://pulsedb.example.com)")
	}

	// Set defaults
	if cfg.Environment == "" {
		cfg.Environment = "production"
	}
	if cfg.AppName == "" {
		cfg.AppName = "unnamed-app"
	}
	if cfg.BatchSize == 0 {
		cfg.BatchSize = 50
	}
	if cfg.FlushInterval == 0 {
		cfg.FlushInterval = 10 * time.Second
	}
	if cfg.HTTPClient == nil {
		cfg.HTTPClient = &http.Client{
			Timeout: 30 * time.Second,
		}
	}

	// Set up logger
	var logger Logger
	if cfg.Logger != nil {
		logger = cfg.Logger
	} else if cfg.Debug {
		logger = &defaultLogger{debug: true}
	} else {
		logger = &defaultLogger{debug: false}
	}

	// Generate session ID: <millis>-<8-hex>
	sessionID := generateSessionID()

	// Create transport
	transport := NewTransport(cfg.APIKey, cfg.Endpoint, cfg.HTTPClient, logger)

	// Create batcher
	batcher := NewBatcher(
		transport,
		cfg.BatchSize,
		cfg.FlushInterval,
		logger,
	)

	// Create tracer and span batcher
	tracer := NewTracer(nil) // Will be set after client creation
	spanBatcher := NewSpanBatcher(nil, cfg.BatchSize, cfg.FlushInterval)

	client := &Client{
		config:      cfg,
		sessionID:   sessionID,
		batcher:     batcher,
		transport:   transport,
		logger:      logger,
		Tracing:     tracer,
		spanBatcher: spanBatcher,
	}

	// Set client reference in tracer + span batcher
	tracer.client = client
	spanBatcher.attachClient(client)

	// Start background batchers
	batcher.Start()
	spanBatcher.Start()

	client.logf("[SDK initialized] endpoint=%s appName=%s environment=%s", cfg.Endpoint, cfg.AppName, cfg.Environment)

	return client, nil
}

// logf is an internal helper for debug logging
func (c *Client) logf(format string, args ...interface{}) {
	if c.logger != nil {
		c.logger.Debugf(format, args...)
	}
}

// TrackAPI tracks an API call with automatic severity mapping
func (c *Client) TrackAPI(method, endpoint string, statusCode int, durationMs int64, metadata map[string]interface{}) {
	if c.isShuttingDown.Load() {
		c.logf("[WARN] SDK is shutting down, event dropped: api")
		return
	}

	if metadata == nil {
		metadata = make(map[string]interface{})
	}

	// Auto-map severity based on status code
	var severity string
	if statusCode >= 500 {
		severity = "error"
	} else if statusCode >= 400 {
		severity = "warning"
	} else {
		severity = "info"
	}

	// Build metadata with HTTP details
	fullMetadata := make(map[string]interface{})
	for k, v := range metadata {
		fullMetadata[k] = v
	}
	fullMetadata["method"] = method
	fullMetadata["endpoint"] = endpoint
	fullMetadata["statusCode"] = statusCode
	fullMetadata["durationMs"] = durationMs

	event := &SdkEvent{
		Type:        "api",
		Title:       fmt.Sprintf("%s %s", method, endpoint),
		Severity:    severity,
		Message:     "",
		Metadata:    fullMetadata,
		Timestamp:   time.Now().UTC().Format(time.RFC3339),
		SessionID:   c.sessionID,
		AppName:     c.config.AppName,
		Environment: c.config.Environment,
	}

	c.batcher.Enqueue(event)
	c.logf("[Queue] Event added: api")
}

// TrackError tracks an error with stack trace
func (c *Client) TrackError(err error, metadata map[string]interface{}) {
	c.TrackErrorTitle(generateErrorTitle(err), "error", metadata)
}

// TrackErrorTitle tracks an error with a custom title and severity
func (c *Client) TrackErrorTitle(title, severity string, metadata map[string]interface{}) {
	if c.isShuttingDown.Load() {
		c.logf("[WARN] SDK is shutting down, event dropped: error")
		return
	}

	if metadata == nil {
		metadata = make(map[string]interface{})
	}

	fullMetadata := make(map[string]interface{})
	for k, v := range metadata {
		fullMetadata[k] = v
	}

	event := &SdkEvent{
		Type:        "error",
		Title:       title,
		Severity:    severity,
		Message:     "",
		Metadata:    fullMetadata,
		Timestamp:   time.Now().UTC().Format(time.RFC3339),
		SessionID:   c.sessionID,
		AppName:     c.config.AppName,
		Environment: c.config.Environment,
	}

	c.batcher.Enqueue(event)
	c.logf("[Queue] Event added: error")
}

// AuditOpts holds options for audit events
type AuditOpts struct {
	Message  string
	Metadata map[string]interface{}
	Severity string
}

// TrackAudit tracks an audit event
func (c *Client) TrackAudit(title string, opts AuditOpts) {
	if c.isShuttingDown.Load() {
		c.logf("[WARN] SDK is shutting down, event dropped: audit")
		return
	}

	if opts.Severity == "" {
		opts.Severity = "info"
	}
	if opts.Metadata == nil {
		opts.Metadata = make(map[string]interface{})
	}

	fullMetadata := make(map[string]interface{})
	for k, v := range opts.Metadata {
		fullMetadata[k] = v
	}
	if opts.Message != "" {
		fullMetadata["message"] = opts.Message
	}

	event := &SdkEvent{
		Type:        "audit",
		Title:       title,
		Severity:    opts.Severity,
		Message:     "",
		Metadata:    fullMetadata,
		Timestamp:   time.Now().UTC().Format(time.RFC3339),
		SessionID:   c.sessionID,
		AppName:     c.config.AppName,
		Environment: c.config.Environment,
	}

	c.batcher.Enqueue(event)
	c.logf("[Queue] Event added: audit")
}

// TrackMetric tracks a metric event
func (c *Client) TrackMetric(title string, value float64, unit string, metadata map[string]interface{}) {
	if c.isShuttingDown.Load() {
		c.logf("[WARN] SDK is shutting down, event dropped: metric")
		return
	}

	if metadata == nil {
		metadata = make(map[string]interface{})
	}

	fullMetadata := make(map[string]interface{})
	for k, v := range metadata {
		fullMetadata[k] = v
	}
	fullMetadata["value"] = value
	if unit != "" {
		fullMetadata["unit"] = unit
	}

	event := &SdkEvent{
		Type:        "metric",
		Title:       title,
		Severity:    "info",
		Message:     "",
		Metadata:    fullMetadata,
		Timestamp:   time.Now().UTC().Format(time.RFC3339),
		SessionID:   c.sessionID,
		AppName:     c.config.AppName,
		Environment: c.config.Environment,
	}

	c.batcher.Enqueue(event)
	c.logf("[Queue] Event added: metric")
}

// Track tracks a custom event
func (c *Client) Track(eventType, title, severity string, metadata map[string]interface{}, tags []string) {
	if c.isShuttingDown.Load() {
		c.logf("[WARN] SDK is shutting down, event dropped: %s", eventType)
		return
	}

	if metadata == nil {
		metadata = make(map[string]interface{})
	}

	fullMetadata := make(map[string]interface{})
	for k, v := range metadata {
		fullMetadata[k] = v
	}
	if len(tags) > 0 {
		fullMetadata["tags"] = tags
	}

	event := &SdkEvent{
		Type:        eventType,
		Title:       title,
		Severity:    severity,
		Message:     "",
		Metadata:    fullMetadata,
		Timestamp:   time.Now().UTC().Format(time.RFC3339),
		SessionID:   c.sessionID,
		AppName:     c.config.AppName,
		Environment: c.config.Environment,
		Tags:        tags,
	}

	c.batcher.Enqueue(event)
	c.logf("[Queue] Event added: %s", eventType)
}

// Heartbeat sends a heartbeat to PulseDB
func (c *Client) Heartbeat(ctx context.Context, status string, metadata map[string]interface{}) error {
	if metadata == nil {
		metadata = make(map[string]interface{})
	}

	c.logf("[Heartbeat] Sending heartbeat: %s", status)
	return c.transport.PostHeartbeat(
		ctx,
		status,
		c.sessionID,
		c.config.AppName,
		c.config.Environment,
		c.batcher.Size(),
		time.Now().UTC().Format(time.RFC3339),
		metadata,
	)
}

// Flush synchronously drains and flushes all events
func (c *Client) Flush(ctx context.Context) error {
	c.logf("[Flush] Starting synchronous flush")
	err := c.batcher.FlushSync(ctx)
	c.logf("[Flush] Complete")
	return err
}

// Shutdown flushes remaining events and stops the batcher
func (c *Client) Shutdown(ctx context.Context) error {
	// Atomically mark shutdown; if already shutting down, no-op (idempotent).
	if !c.isShuttingDown.CompareAndSwap(false, true) {
		return nil
	}

	c.logf("[Shutdown] Initiating SDK shutdown...")

	// Stop background flush thread (also drains eventChan into the queue)
	c.batcher.Stop()

	// Flush remaining events (including anything Stop() drained out of the channel).
	if c.batcher.Size() > 0 {
		c.logf("[Shutdown] Flushing remaining events")
		if err := c.batcher.FlushSync(ctx); err != nil {
			c.logf("[Shutdown] Flush error: %v", err)
			return err
		}
	}

	// Flush remaining spans
	if c.spanBatcher.Size() > 0 {
		c.logf("[Shutdown] Flushing remaining spans")
		if err := c.spanBatcher.FlushSync(ctx); err != nil {
			c.logf("[Shutdown] Span flush error: %v", err)
			return err
		}
	}

	c.spanBatcher.Stop()

	c.logf("[Shutdown] Complete")
	return nil
}

// CaptureUncaughtPanics installs a defer/recover helper for panic recovery
// In Go, panics are typically handled via defer/recover in main or via middleware
// This method is a placeholder to match the JS/Python API but doesn't install global hooks
func (c *Client) CaptureUncaughtPanics() {
	c.logf("[SDK] Panic capture available via defer/recover in your code")
}

// SafeRecover is a helper for middleware to safely recover from panics
func (c *Client) SafeRecover() {
	if r := recover(); r != nil {
		c.TrackErrorTitle(
			fmt.Sprintf("panic: %v", r),
			"critical",
			map[string]interface{}{
				"type": "panic",
				"value": fmt.Sprintf("%v", r),
			},
		)
		// Re-panic after tracking
		panic(r)
	}
}

// defaultLogger is a simple built-in logger
type defaultLogger struct {
	debug bool
}

func (l *defaultLogger) Debugf(format string, args ...interface{}) {
	if l.debug {
		fmt.Printf("[PulseDB] "+format+"\n", args...)
	}
}

func (l *defaultLogger) Infof(format string, args ...interface{}) {
	fmt.Printf("[PulseDB] "+format+"\n", args...)
}

func (l *defaultLogger) Warnf(format string, args ...interface{}) {
	fmt.Printf("[PulseDB] "+format+"\n", args...)
}

func (l *defaultLogger) Errorf(format string, args ...interface{}) {
	fmt.Printf("[PulseDB] "+format+"\n", args...)
}
