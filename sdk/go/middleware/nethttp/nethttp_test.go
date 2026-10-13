package nethttp

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"

	"github.com/fathom/fathom-go"
)

func TestMiddlewareTracksRequest(t *testing.T) {
	var eventCaptured atomic.Bool

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/api/sdk/ingest" {
			var payload map[string]interface{}
			body, _ := io.ReadAll(r.Body)
			json.Unmarshal(body, &payload)

			events, ok := payload["events"].([]interface{})
			if ok && len(events) > 0 {
				event := events[0].(map[string]interface{})
				if event["type"] == "api" {
					eventCaptured.Store(true)
				}
			}

			w.WriteHeader(http.StatusOK)
			w.Write([]byte(`{"ingested": 1}`))
		} else {
			// Regular handler
			w.WriteHeader(http.StatusOK)
			w.Write([]byte("OK"))
		}
	}))
	defer server.Close()

	client, err := fathom.New(fathom.Config{
		APIKey:        "sk_live_test",
		Endpoint:      server.URL,
		BatchSize:     1,
		FlushInterval: 100 * time.Millisecond,
	})
	if err != nil {
		t.Fatal(err)
	}
	defer client.Shutdown(context.Background())

	// Create handler
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("test"))
	})

	// Wrap with middleware
	wrapped := Middleware(client)(handler)

	// Create test request
	req := httptest.NewRequest("GET", "/api/test", nil)
	w := httptest.NewRecorder()

	wrapped.ServeHTTP(w, req)

	// Wait for event to be flushed
	time.Sleep(200 * time.Millisecond)

	if !eventCaptured.Load() {
		t.Error("API event not captured")
	}
}

func TestMiddlewareRecordsStatusCode(t *testing.T) {
	var statusCodeCaptured atomic.Bool

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/api/sdk/ingest" {
			var payload map[string]interface{}
			body, _ := io.ReadAll(r.Body)
			json.Unmarshal(body, &payload)

			events, ok := payload["events"].([]interface{})
			if ok && len(events) > 0 {
				event := events[0].(map[string]interface{})
				metadata := event["metadata"].(map[string]interface{})
				if metadata["statusCode"].(float64) == 404 {
					statusCodeCaptured.Store(true)
				}
			}

			w.WriteHeader(http.StatusOK)
			w.Write([]byte(`{"ingested": 1}`))
		} else {
			w.WriteHeader(http.StatusNotFound)
			w.Write([]byte("not found"))
		}
	}))
	defer server.Close()

	client, _ := fathom.New(fathom.Config{
		APIKey:        "sk_live_test",
		Endpoint:      server.URL,
		BatchSize:     1,
		FlushInterval: 100 * time.Millisecond,
	})
	defer client.Shutdown(context.Background())

	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNotFound)
		w.Write([]byte("not found"))
	})

	wrapped := Middleware(client)(handler)

	req := httptest.NewRequest("GET", "/api/test", nil)
	w := httptest.NewRecorder()

	wrapped.ServeHTTP(w, req)

	time.Sleep(200 * time.Millisecond)

	if !statusCodeCaptured.Load() {
		t.Error("404 status code not captured")
	}
}

func TestMiddlewareRecordsMethod(t *testing.T) {
	var methodCaptured atomic.Bool

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/api/sdk/ingest" {
			var payload map[string]interface{}
			body, _ := io.ReadAll(r.Body)
			json.Unmarshal(body, &payload)

			events, ok := payload["events"].([]interface{})
			if ok && len(events) > 0 {
				event := events[0].(map[string]interface{})
				metadata := event["metadata"].(map[string]interface{})
				if metadata["method"] == "POST" {
					methodCaptured.Store(true)
				}
			}

			w.WriteHeader(http.StatusOK)
			w.Write([]byte(`{"ingested": 1}`))
		} else {
			w.WriteHeader(http.StatusOK)
			w.Write([]byte("OK"))
		}
	}))
	defer server.Close()

	client, _ := fathom.New(fathom.Config{
		APIKey:        "sk_live_test",
		Endpoint:      server.URL,
		BatchSize:     1,
		FlushInterval: 100 * time.Millisecond,
	})
	defer client.Shutdown(context.Background())

	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	})

	wrapped := Middleware(client)(handler)

	req := httptest.NewRequest("POST", "/api/data", nil)
	w := httptest.NewRecorder()

	wrapped.ServeHTTP(w, req)

	time.Sleep(200 * time.Millisecond)

	if !methodCaptured.Load() {
		t.Error("POST method not captured")
	}
}

func TestMiddlewareRecordsDuration(t *testing.T) {
	var durationRecorded atomic.Bool

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/api/sdk/ingest" {
			var payload map[string]interface{}
			body, _ := io.ReadAll(r.Body)
			json.Unmarshal(body, &payload)

			events, ok := payload["events"].([]interface{})
			if ok && len(events) > 0 {
				event := events[0].(map[string]interface{})
				metadata := event["metadata"].(map[string]interface{})
				if duration, ok := metadata["durationMs"]; ok && duration.(float64) > 0 {
					durationRecorded.Store(true)
				}
			}

			w.WriteHeader(http.StatusOK)
			w.Write([]byte(`{"ingested": 1}`))
		} else {
			w.WriteHeader(http.StatusOK)
			w.Write([]byte("OK"))
		}
	}))
	defer server.Close()

	client, _ := fathom.New(fathom.Config{
		APIKey:        "sk_live_test",
		Endpoint:      server.URL,
		BatchSize:     1,
		FlushInterval: 100 * time.Millisecond,
	})
	defer client.Shutdown(context.Background())

	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		time.Sleep(10 * time.Millisecond)
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	})

	wrapped := Middleware(client)(handler)

	req := httptest.NewRequest("GET", "/api/test", nil)
	w := httptest.NewRecorder()

	wrapped.ServeHTTP(w, req)

	time.Sleep(200 * time.Millisecond)

	if !durationRecorded.Load() {
		t.Error("duration not recorded")
	}
}

func TestResponseWriterDefaultStatus(t *testing.T) {
	rw := &responseWriter{ResponseWriter: httptest.NewRecorder(), statusCode: http.StatusOK}

	if rw.statusCode != http.StatusOK {
		t.Errorf("expected default status 200, got %d", rw.statusCode)
	}
}

func TestResponseWriterCapture(t *testing.T) {
	recorder := httptest.NewRecorder()
	rw := &responseWriter{ResponseWriter: recorder}

	rw.WriteHeader(http.StatusCreated)

	if rw.statusCode != http.StatusCreated {
		t.Errorf("expected status 201, got %d", rw.statusCode)
	}

	if recorder.Code != http.StatusCreated {
		t.Errorf("expected recorder code 201, got %d", recorder.Code)
	}
}
