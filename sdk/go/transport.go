package fathom

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"math/rand"
	"net"
	"net/http"
	"time"
)

// Transport handles HTTP communication with FATHOM backend
type Transport struct {
	apiKey     string
	endpoint   string
	httpClient *http.Client
	logger     Logger
}

// NewTransport creates a new Transport instance
func NewTransport(apiKey, endpoint string, httpClient *http.Client, logger Logger) *Transport {
	if httpClient == nil {
		httpClient = &http.Client{
			Timeout: 10 * time.Second,
		}
	}

	return &Transport{
		apiKey:     apiKey,
		endpoint:   endpoint,
		httpClient: httpClient,
		logger:     logger,
	}
}

// PostIngest sends a batch of events to /api/sdk/ingest
// Implements retry with exponential backoff: 200ms * 2^n plus 0-100ms jitter
// Returns (ingested count, error)
func (t *Transport) PostIngest(ctx context.Context, events []*SdkEvent) (int, error) {
	if len(events) == 0 {
		return 0, nil
	}

	payload := map[string]interface{}{
		"events": events,
	}

	body, err := json.Marshal(payload)
	if err != nil {
		t.logf("Failed to marshal events: %v", err)
		return 0, err
	}

	url := fmt.Sprintf("%s/api/sdk/ingest", t.endpoint)

	// Retry up to 3 times with backoff
	for attempt := 0; attempt < 3; attempt++ {
		resp, err := t.doPostWithContext(ctx, url, body)
		if err != nil {
			// Network error or context error - check if transient
			if isTransientError(err) {
				t.logf("[Retry] Attempt %d failed (transient): %v", attempt+1, err)
				if attempt < 2 { // Don't sleep after last attempt
					t.backoffSleep(attempt)
				}
				continue
			}
			// Non-transient error
			return 0, err
		}

		defer resp.Body.Close()

		// Handle response codes
		if resp.StatusCode >= 500 || resp.StatusCode == 429 {
			// Transient: 5xx or 429 (rate limit)
			bodyBytes, _ := io.ReadAll(resp.Body)
			t.logf("[Retry] Attempt %d returned %d: %s", attempt+1, resp.StatusCode, string(bodyBytes))
			if attempt < 2 {
				t.backoffSleep(attempt)
			}
			continue
		}

		if resp.StatusCode >= 400 {
			// Non-transient: 4xx (except 429)
			bodyBytes, _ := io.ReadAll(resp.Body)
			t.logf("[ERROR] HTTP %d: %s", resp.StatusCode, string(bodyBytes))
			return 0, fmt.Errorf("HTTP %d", resp.StatusCode)
		}

		// Success: 2xx
		respBody, err := io.ReadAll(resp.Body)
		if err != nil {
			return 0, err
		}

		var result map[string]interface{}
		if err := json.Unmarshal(respBody, &result); err != nil {
			return 0, err
		}

		ingested := 0
		if v, ok := result["ingested"].(float64); ok {
			ingested = int(v)
		}

		t.logf("[Flush] Success (%d events ingested)", ingested)
		return ingested, nil
	}

	return 0, fmt.Errorf("failed to ingest events after 3 retries")
}

// PostHeartbeat sends a heartbeat to /api/sdk/heartbeat
// PostRaw POSTs a pre-marshalled JSON body to a non-/ingest path on the
// same backend, sharing the apiKey header. Used by the FATHOM agent
// (C1) to forward wait-event and query-stats batches without
// re-implementing the back-off + retry envelope inside transport.go.
//
// Returns the HTTP response body on 2xx or a wrapped error otherwise.
func (t *Transport) PostRaw(ctx context.Context, path string, body []byte) error {
	url := t.endpoint + path

	resp, err := t.doPostWithContext(ctx, url, body)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		// Drain so the connection can be reused.
		_, _ = io.Copy(io.Discard, resp.Body)
		return nil
	}
	respBody, _ := io.ReadAll(resp.Body)
	return fmt.Errorf("PostRaw %s: %d: %s", path, resp.StatusCode, string(respBody))
}

func (t *Transport) PostHeartbeat(ctx context.Context, status, sessionID, appName, environment string, queueSize int, timestamp string, metadata map[string]interface{}) error {
	payload := map[string]interface{}{
		"status":      status,
		"sessionId":   sessionID,
		"appName":     appName,
		"environment": environment,
		"queueSize":   queueSize,
		"timestamp":   timestamp,
		"metadata":    metadata,
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	url := fmt.Sprintf("%s/api/sdk/heartbeat", t.endpoint)

	resp, err := t.doPostWithContext(ctx, url, body)
	if err != nil {
		t.logf("[WARN] Heartbeat failed: %v", err)
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		t.logf("[WARN] Heartbeat HTTP %d: %s", resp.StatusCode, string(bodyBytes))
		return fmt.Errorf("HTTP %d", resp.StatusCode)
	}

	t.logf("[Heartbeat] Success")
	return nil
}

// GetHealth checks the health endpoint (/api/sdk/health)
func (t *Transport) GetHealth(ctx context.Context) (bool, error) {
	url := fmt.Sprintf("%s/api/sdk/health", t.endpoint)

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return false, err
	}

	resp, err := t.httpClient.Do(req)
	if err != nil {
		return false, err
	}
	defer resp.Body.Close()

	return resp.StatusCode == http.StatusOK, nil
}

// doPostWithContext performs a POST request with context and auth header
func (t *Transport) doPostWithContext(ctx context.Context, url string, body []byte) (*http.Response, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-SDK-Key", t.apiKey)

	return t.httpClient.Do(req)
}

// isTransientError checks if an error is transient (retryable)
func isTransientError(err error) bool {
	// Network errors are transient
	if _, ok := err.(net.Error); ok {
		return true
	}

	// Timeout errors are transient
	if _, ok := err.(interface{ Timeout() bool }); ok {
		if err.(interface{ Timeout() bool }).Timeout() {
			return true
		}
	}

	// Check for context deadline exceeded
	if err == context.DeadlineExceeded {
		return true
	}

	return false
}

// backoffSleep implements exponential backoff: 200ms * 2^n plus 0-100ms jitter
func (t *Transport) backoffSleep(attempt int) {
	// Base delay: 200ms * 2^attempt
	baseMs := 200 * math.Pow(2, float64(attempt))
	// Jitter: 0-100ms
	jitter := time.Duration(rand.Intn(101)) * time.Millisecond
	delay := time.Duration(baseMs)*time.Millisecond + jitter
	time.Sleep(delay)
}

// logf is a helper for logging
func (t *Transport) logf(format string, args ...interface{}) {
	if t.logger != nil {
		t.logger.Debugf(format, args...)
	}
}
