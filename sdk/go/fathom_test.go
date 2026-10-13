package fathom

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

func TestNewClient(t *testing.T) {
	tests := []struct {
		name    string
		config  Config
		wantErr bool
	}{
		{
			name: "valid config",
			config: Config{
				APIKey:   "sk_live_test",
				Endpoint: "http://localhost:3000",
			},
			wantErr: false,
		},
		{
			name: "missing api key",
			config: Config{
				APIKey:   "",
				Endpoint: "http://localhost:3000",
			},
			wantErr: true,
		},
		{
			name: "missing endpoint",
			config: Config{
				APIKey:   "sk_live_test",
				Endpoint: "",
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			client, err := New(tt.config)
			if (err != nil) != tt.wantErr {
				t.Errorf("New() error = %v, wantErr %v", err, tt.wantErr)
			}
			if client != nil && !tt.wantErr {
				client.Shutdown(context.Background())
			}
		})
	}
}

func TestTrackAPI(t *testing.T) {
	// Create mock server
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/sdk/ingest" {
			t.Errorf("unexpected path: %s", r.URL.Path)
		}

		if r.Header.Get("X-SDK-Key") == "" {
			t.Error("missing X-SDK-Key header")
		}

		var payload map[string]interface{}
		body, _ := io.ReadAll(r.Body)
		json.Unmarshal(body, &payload)

		events, ok := payload["events"].([]interface{})
		if !ok || len(events) == 0 {
			t.Error("no events in payload")
		} else {
			event := events[0].(map[string]interface{})
			if event["type"] != "api" {
				t.Errorf("expected event type 'api', got %v", event["type"])
			}
		}

		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"ingested": 1}`))
	}))
	defer server.Close()

	client, err := New(Config{
		APIKey:        "sk_live_test",
		Endpoint:      server.URL,
		BatchSize:     1,
		FlushInterval: 100 * time.Millisecond,
	})
	if err != nil {
		t.Fatal(err)
	}
	defer client.Shutdown(context.Background())

	client.TrackAPI("GET", "/api/users", 200, 45, nil)

	// Wait for batch to flush
	time.Sleep(200 * time.Millisecond)
}

func TestTrackError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var payload map[string]interface{}
		body, _ := io.ReadAll(r.Body)
		json.Unmarshal(body, &payload)

		events, ok := payload["events"].([]interface{})
		if !ok || len(events) == 0 {
			t.Error("no events in payload")
		} else {
			event := events[0].(map[string]interface{})
			if event["type"] != "error" {
				t.Errorf("expected event type 'error', got %v", event["type"])
			}
		}

		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"ingested": 1}`))
	}))
	defer server.Close()

	client, err := New(Config{
		APIKey:        "sk_live_test",
		Endpoint:      server.URL,
		BatchSize:     1,
		FlushInterval: 100 * time.Millisecond,
	})
	if err != nil {
		t.Fatal(err)
	}
	defer client.Shutdown(context.Background())

	testErr := &testError{msg: "test error"}
	client.TrackError(testErr, nil)

	time.Sleep(200 * time.Millisecond)
}

func TestAutoSeverityMapping(t *testing.T) {
	tests := []struct {
		statusCode int
		expected   string
	}{
		{200, "info"},
		{201, "info"},
		{300, "info"},
		{400, "warning"},
		{401, "warning"},
		{404, "warning"},
		{500, "error"},
		{502, "error"},
		{503, "error"},
	}

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var payload map[string]interface{}
		body, _ := io.ReadAll(r.Body)
		json.Unmarshal(body, &payload)

		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"ingested": 1}`))
	}))
	defer server.Close()

	for _, tt := range tests {
		t.Run(fmt.Sprintf("status_%d", tt.statusCode), func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				var payload map[string]interface{}
				body, _ := io.ReadAll(r.Body)
				json.Unmarshal(body, &payload)

				events, _ := payload["events"].([]interface{})
				event := events[0].(map[string]interface{})
				severity := event["severity"].(string)

				if severity != tt.expected {
					t.Errorf("status %d: expected severity %s, got %s", tt.statusCode, tt.expected, severity)
				}

				w.WriteHeader(http.StatusOK)
				w.Write([]byte(`{"ingested": 1}`))
			}))
			defer server.Close()

			client, _ := New(Config{
				APIKey:        "sk_live_test",
				Endpoint:      server.URL,
				BatchSize:     1,
				FlushInterval: 50 * time.Millisecond,
			})
			defer client.Shutdown(context.Background())

			client.TrackAPI("GET", "/test", tt.statusCode, 100, nil)
			time.Sleep(150 * time.Millisecond)
		})
	}
}

func TestBatchFlushing(t *testing.T) {
	var batchCount int32
	var eventCounts []int
	var mu sync.Mutex

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var payload map[string]interface{}
		body, _ := io.ReadAll(r.Body)
		json.Unmarshal(body, &payload)

		events, _ := payload["events"].([]interface{})
		mu.Lock()
		eventCounts = append(eventCounts, len(events))
		mu.Unlock()
		atomic.AddInt32(&batchCount, 1)

		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"ingested": 1}`))
	}))
	defer server.Close()

	client, err := New(Config{
		APIKey:        "sk_live_test",
		Endpoint:      server.URL,
		BatchSize:     3,
		FlushInterval: 500 * time.Millisecond,
	})
	if err != nil {
		t.Fatal(err)
	}
	defer client.Shutdown(context.Background())

	// Add 5 events - should trigger at least 1 flush (batch size 3)
	client.TrackAPI("GET", "/1", 200, 10, nil)
	client.TrackAPI("GET", "/2", 200, 10, nil)
	client.TrackAPI("GET", "/3", 200, 10, nil)

	// Wait for first batch
	time.Sleep(100 * time.Millisecond)

	if atomic.LoadInt32(&batchCount) == 0 {
		t.Fatal("batch never flushed")
	}

	mu.Lock()
	first := eventCounts[0]
	mu.Unlock()
	if first != 3 {
		t.Errorf("expected first batch to have 3 events, got %d", first)
	}
}

func TestHeartbeat(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/sdk/heartbeat" {
			t.Errorf("unexpected path: %s", r.URL.Path)
		}

		var payload map[string]interface{}
		body, _ := io.ReadAll(r.Body)
		json.Unmarshal(body, &payload)

		if payload["status"] != "healthy" {
			t.Errorf("expected status 'healthy', got %v", payload["status"])
		}

		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"acknowledged": true}`))
	}))
	defer server.Close()

	client, err := New(Config{
		APIKey:   "sk_live_test",
		Endpoint: server.URL,
	})
	if err != nil {
		t.Fatal(err)
	}
	defer client.Shutdown(context.Background())

	err = client.Heartbeat(context.Background(), "healthy", nil)
	if err != nil {
		t.Errorf("heartbeat failed: %v", err)
	}
}

func TestShutdown(t *testing.T) {
	var eventCount int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var payload map[string]interface{}
		body, _ := io.ReadAll(r.Body)
		json.Unmarshal(body, &payload)

		events, _ := payload["events"].([]interface{})
		atomic.AddInt32(&eventCount, int32(len(events)))

		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"ingested": 1}`))
	}))
	defer server.Close()

	client, err := New(Config{
		APIKey:        "sk_live_test",
		Endpoint:      server.URL,
		BatchSize:     10,
		FlushInterval: 5 * time.Second,
	})
	if err != nil {
		t.Fatal(err)
	}

	// Add some events
	client.TrackAPI("GET", "/1", 200, 10, nil)
	client.TrackAPI("GET", "/2", 200, 10, nil)

	// Shutdown should flush remaining events
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	client.Shutdown(ctx)

	if got := atomic.LoadInt32(&eventCount); got != 2 {
		t.Errorf("expected 2 events flushed on shutdown, got %d", got)
	}
}

// Test helper error type
type testError struct {
	msg string
}

func (e *testError) Error() string {
	return e.msg
}
