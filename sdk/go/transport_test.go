package fathom

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
)

func TestTransportPostIngest(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Verify request details
		if r.Method != http.MethodPost {
			t.Errorf("expected POST, got %s", r.Method)
		}

		if r.URL.Path != "/api/sdk/ingest" {
			t.Errorf("expected path /api/sdk/ingest, got %s", r.URL.Path)
		}

		// Check auth header
		apiKey := r.Header.Get("X-SDK-Key")
		if apiKey != "sk_live_test" {
			t.Errorf("expected X-SDK-Key header, got %s", apiKey)
		}

		// Check content type
		if r.Header.Get("Content-Type") != "application/json" {
			t.Errorf("expected Content-Type application/json, got %s", r.Header.Get("Content-Type"))
		}

		// Parse body
		var payload map[string]interface{}
		body, _ := io.ReadAll(r.Body)
		json.Unmarshal(body, &payload)

		events, ok := payload["events"].([]interface{})
		if !ok || len(events) == 0 {
			t.Error("no events in payload")
		}

		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"ingested": 1}`))
	}))
	defer server.Close()

	transport := NewTransport("sk_live_test", server.URL, nil, nil)
	events := []*SdkEvent{
		{
			Type:     "test",
			Title:    "Test Event",
			Severity: "info",
		},
	}

	ingested, err := transport.PostIngest(context.Background(), events)
	if err != nil {
		t.Errorf("post ingest failed: %v", err)
	}

	if ingested != 1 {
		t.Errorf("expected 1 ingested, got %d", ingested)
	}
}

func TestTransportPostHeartbeat(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/sdk/heartbeat" {
			t.Errorf("expected path /api/sdk/heartbeat, got %s", r.URL.Path)
		}

		var payload map[string]interface{}
		body, _ := io.ReadAll(r.Body)
		json.Unmarshal(body, &payload)

		if payload["status"] != "healthy" {
			t.Errorf("expected status healthy, got %v", payload["status"])
		}

		if payload["sessionId"] == nil {
			t.Error("missing sessionId")
		}

		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"acknowledged": true}`))
	}))
	defer server.Close()

	transport := NewTransport("sk_live_test", server.URL, nil, nil)
	err := transport.PostHeartbeat(context.Background(), "healthy", "session-123", "app-1", "prod", 5, "2025-01-01T00:00:00Z", nil)
	if err != nil {
		t.Errorf("heartbeat failed: %v", err)
	}
}

func TestTransportGetHealth(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/sdk/health" {
			t.Errorf("expected path /api/sdk/health, got %s", r.URL.Path)
		}

		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status": "ok"}`))
	}))
	defer server.Close()

	transport := NewTransport("sk_live_test", server.URL, nil, nil)
	healthy, err := transport.GetHealth(context.Background())
	if err != nil {
		t.Errorf("health check failed: %v", err)
	}

	if !healthy {
		t.Error("expected healthy=true")
	}
}

func TestTransportRetry(t *testing.T) {
	attemptCount := int32(0)

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		count := atomic.AddInt32(&attemptCount, 1)

		// Fail first two attempts with 503
		if count <= 2 {
			w.WriteHeader(http.StatusServiceUnavailable)
			w.Write([]byte("service unavailable"))
			return
		}

		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"ingested": 1}`))
	}))
	defer server.Close()

	transport := NewTransport("sk_live_test", server.URL, nil, nil)
	events := []*SdkEvent{
		{Type: "test", Title: "Event", Severity: "info"},
	}

	ingested, err := transport.PostIngest(context.Background(), events)
	if err != nil {
		t.Errorf("post ingest failed: %v", err)
	}

	if atomic.LoadInt32(&attemptCount) < 3 {
		t.Error("expected at least 3 attempts")
	}

	if ingested != 1 {
		t.Errorf("expected 1 ingested, got %d", ingested)
	}
}

func TestTransportNonRetryableError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// 400 Bad Request should not be retried
		w.WriteHeader(http.StatusBadRequest)
		w.Write([]byte(`{"error": "bad request"}`))
	}))
	defer server.Close()

	transport := NewTransport("sk_live_test", server.URL, nil, nil)
	events := []*SdkEvent{
		{Type: "test", Title: "Event", Severity: "info"},
	}

	_, err := transport.PostIngest(context.Background(), events)
	if err == nil {
		t.Error("expected error for 400 response")
	}

	if !strings.Contains(err.Error(), "400") {
		t.Errorf("expected error to mention 400, got %v", err)
	}
}

func TestTransport429Retry(t *testing.T) {
	attemptCount := int32(0)

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		count := atomic.AddInt32(&attemptCount, 1)

		// Fail first attempt with 429 (rate limit)
		if count == 1 {
			w.WriteHeader(http.StatusTooManyRequests)
			w.Write([]byte("rate limited"))
			return
		}

		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"ingested": 1}`))
	}))
	defer server.Close()

	transport := NewTransport("sk_live_test", server.URL, nil, nil)
	events := []*SdkEvent{
		{Type: "test", Title: "Event", Severity: "info"},
	}

	_, err := transport.PostIngest(context.Background(), events)
	if err != nil {
		t.Errorf("post ingest failed: %v", err)
	}

	if atomic.LoadInt32(&attemptCount) < 2 {
		t.Error("429 should be retried")
	}
}

func TestTransportEmptyBatch(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Error("should not call server for empty batch")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"ingested": 0}`))
	}))
	defer server.Close()

	transport := NewTransport("sk_live_test", server.URL, nil, nil)
	ingested, err := transport.PostIngest(context.Background(), nil)
	if err != nil {
		t.Errorf("unexpected error: %v", err)
	}

	if ingested != 0 {
		t.Errorf("expected 0 ingested for empty batch, got %d", ingested)
	}
}

func TestTransportConcurrentRequests(t *testing.T) {
	successCount := int32(0)

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		atomic.AddInt32(&successCount, 1)
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"ingested": 1}`))
	}))
	defer server.Close()

	transport := NewTransport("sk_live_test", server.URL, nil, nil)

	// Make multiple concurrent requests
	wg := &sync.WaitGroup{}
	for i := 0; i < 5; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			events := []*SdkEvent{
				{Type: "test", Title: "Event", Severity: "info"},
			}
			_, err := transport.PostIngest(context.Background(), events)
			if err != nil {
				t.Errorf("post ingest failed: %v", err)
			}
		}()
	}

	wg.Wait()

	if atomic.LoadInt32(&successCount) != 5 {
		t.Errorf("expected 5 successful requests, got %d", successCount)
	}
}

func TestTransportAuthHeaderPresence(t *testing.T) {
	headerReceived := false
	mu := &sync.Mutex{}

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		mu.Lock()
		if r.Header.Get("X-SDK-Key") != "" {
			headerReceived = true
		}
		mu.Unlock()

		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"ingested": 1}`))
	}))
	defer server.Close()

	transport := NewTransport("sk_live_mykey", server.URL, nil, nil)
	events := []*SdkEvent{
		{Type: "test", Title: "Event", Severity: "info"},
	}

	transport.PostIngest(context.Background(), events)

	mu.Lock()
	if !headerReceived {
		t.Error("X-SDK-Key header not received")
	}
	mu.Unlock()
}

func TestIsTransientError(t *testing.T) {
	tests := []struct {
		name       string
		err        error
		transient  bool
	}{
		{
			name:      "context timeout",
			err:       context.DeadlineExceeded,
			transient: true,
		},
		{
			name:      "regular error",
			err:       fmt.Errorf("some error"),
			transient: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := isTransientError(tt.err)
			if result != tt.transient {
				t.Errorf("expected transient=%v, got %v", tt.transient, result)
			}
		})
	}
}
