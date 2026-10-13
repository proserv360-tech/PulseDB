package fathom

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"sync"
	"time"
)

// SpanBatcher collects spans and flushes to /api/otlp/v1/traces
type SpanBatcher struct {
	client                *Client
	batchSize             int
	flushIntervalDuration time.Duration
	queue                 []*Span
	mu                    sync.RWMutex
	ticker                *time.Ticker
	done                  chan struct{}
	isShuttingDown        bool
	logger                Logger
}

// NewSpanBatcher creates a new span batcher
func NewSpanBatcher(client *Client, batchSize int, flushInterval time.Duration) *SpanBatcher {
	sb := &SpanBatcher{
		client:                client,
		batchSize:             batchSize,
		flushIntervalDuration: flushInterval,
		queue:                 []*Span{},
		done:                  make(chan struct{}),
	}
	if client != nil {
		sb.logger = client.logger
	}
	return sb
}

// attachClient wires a client to a span batcher constructed with a nil
// client — used during client initialisation where the batcher is built
// before the Client struct to avoid an initialisation cycle.
func (sb *SpanBatcher) attachClient(client *Client) {
	sb.client = client
	if client != nil && sb.logger == nil {
		sb.logger = client.logger
	}
}

// Enqueue adds a span to the queue
func (sb *SpanBatcher) Enqueue(span *Span) {
	sb.mu.Lock()
	defer sb.mu.Unlock()

	if sb.isShuttingDown {
		return
	}

	sb.queue = append(sb.queue, span)

	// Auto-flush if queue exceeds batchSize
	if len(sb.queue) >= sb.batchSize {
		go sb.Flush(context.Background())
	}
}

// Start begins the background flush ticker
func (sb *SpanBatcher) Start() {
	sb.ticker = time.NewTicker(sb.flushIntervalDuration)

	go func() {
		for {
			select {
			case <-sb.ticker.C:
				sb.mu.RLock()
				size := len(sb.queue)
				sb.mu.RUnlock()

				if size > 0 {
					sb.Flush(context.Background())
				}
			case <-sb.done:
				return
			}
		}
	}()
}

// Stop stops the background flush ticker
func (sb *SpanBatcher) Stop() {
	if sb.ticker != nil {
		sb.ticker.Stop()
		close(sb.done)
	}
}

// Flush flushes all queued spans to OTLP endpoint
func (sb *SpanBatcher) Flush(ctx context.Context) error {
	sb.mu.Lock()

	if len(sb.queue) == 0 {
		sb.mu.Unlock()
		return nil
	}

	// Take first batchSize spans
	batchEnd := sb.batchSize
	if batchEnd > len(sb.queue) {
		batchEnd = len(sb.queue)
	}

	batch := make([]*Span, batchEnd)
	copy(batch, sb.queue[:batchEnd])

	// Remove batch from queue
	sb.queue = append(sb.queue[:0], sb.queue[batchEnd:]...)
	sb.mu.Unlock()

	// Build payload
	payload := sb.buildOtlpPayload(batch)

	// Convert to JSON
	body, err := json.Marshal(payload)
	if err != nil {
		sb.logger.Errorf("[Span Batcher] JSON marshal failed: %v", err)
		// Re-queue on failure
		sb.mu.Lock()
		sb.queue = append(batch, sb.queue...)
		sb.mu.Unlock()
		return err
	}

	// Make HTTP request
	url := fmt.Sprintf("%s/api/otlp/v1/traces", sb.client.config.Endpoint)

	req, err := newSpanBatcherRequest(ctx, "POST", url, bytes.NewReader(body))
	if err != nil {
		sb.logger.Errorf("[Span Batcher] Failed to create request: %v", err)
		// Re-queue on failure
		sb.mu.Lock()
		sb.queue = append(batch, sb.queue...)
		sb.mu.Unlock()
		return err
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-SDK-Key", sb.client.config.APIKey)

	resp, err := sb.client.config.HTTPClient.Do(req)
	if err != nil {
		sb.logger.Errorf("[Span Batcher] HTTP request failed: %v", err)
		// Re-queue on failure
		sb.mu.Lock()
		sb.queue = append(batch, sb.queue...)
		sb.mu.Unlock()
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		sb.logger.Errorf("[Span Batcher] HTTP %d", resp.StatusCode)
		// Re-queue on failure
		sb.mu.Lock()
		sb.queue = append(batch, sb.queue...)
		sb.mu.Unlock()
		return fmt.Errorf("HTTP %d", resp.StatusCode)
	}

	sb.logger.Debugf("[Span Flush] Success (%d spans)", len(batch))
	return nil
}

// FlushSync synchronously flushes all spans
func (sb *SpanBatcher) FlushSync(ctx context.Context) error {
	sb.mu.RLock()
	size := len(sb.queue)
	sb.mu.RUnlock()

	for size > 0 {
		if err := sb.Flush(ctx); err != nil {
			return err
		}

		sb.mu.RLock()
		size = len(sb.queue)
		sb.mu.RUnlock()
	}

	return nil
}

// Size returns the current queue size
func (sb *SpanBatcher) Size() int {
	sb.mu.RLock()
	defer sb.mu.RUnlock()
	return len(sb.queue)
}

// Shutdown flushes remaining and stops batcher
func (sb *SpanBatcher) Shutdown(ctx context.Context) error {
	sb.mu.Lock()
	sb.isShuttingDown = true
	sb.mu.Unlock()

	sb.Stop()

	return sb.FlushSync(ctx)
}

// buildOtlpPayload builds OTLP/HTTP payload from spans
func (sb *SpanBatcher) buildOtlpPayload(spans []*Span) map[string]interface{} {
	otlpSpans := []map[string]interface{}{}

	for _, span := range spans {
		otlpSpans = append(otlpSpans, span.ToOtlpSpan())
	}

	return map[string]interface{}{
		"resourceSpans": []map[string]interface{}{
			{
				"resource": map[string]interface{}{
					"attributes": []map[string]interface{}{
						{
							"key": "service.name",
							"value": map[string]interface{}{
								"stringValue": sb.client.config.AppName,
							},
						},
						{
							"key": "service.version",
							"value": map[string]interface{}{
								"stringValue": "1.0.0",
							},
						},
					},
				},
				"scopeSpans": []map[string]interface{}{
					{
						"scope": map[string]interface{}{
							"name":    "@fathom/sdk",
							"version": "1.0.0",
						},
						"spans": otlpSpans,
					},
				},
			},
		},
	}
}

// newSpanBatcherRequest creates a new HTTP request for span batching
func newSpanBatcherRequest(ctx context.Context, method, url string, body io.Reader) (*http.Request, error) {
	return http.NewRequestWithContext(ctx, method, url, body)
}
