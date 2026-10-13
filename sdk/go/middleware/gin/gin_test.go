package gin

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"

	"github.com/fathom/fathom-go"
	"github.com/gin-gonic/gin"
)

func TestGinMiddlewareTracksRequest(t *testing.T) {
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

	// Create router
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(Middleware(client))

	router.GET("/api/test", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	// Make request
	req := httptest.NewRequest("GET", "/api/test", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	// Wait for event to be flushed
	time.Sleep(200 * time.Millisecond)

	if !eventCaptured.Load() {
		t.Error("API event not captured")
	}
}

func TestGinMiddlewareRecordsStatusCode(t *testing.T) {
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
				if status, ok := metadata["statusCode"]; ok {
					if status.(float64) == 404 {
						statusCodeCaptured.Store(true)
					}
				}
			}

			w.WriteHeader(http.StatusOK)
			w.Write([]byte(`{"ingested": 1}`))
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

	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(Middleware(client))

	router.GET("/api/test", func(c *gin.Context) {
		c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
	})

	req := httptest.NewRequest("GET", "/api/test", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	time.Sleep(200 * time.Millisecond)

	if !statusCodeCaptured.Load() {
		t.Error("404 status code not captured")
	}
}

func TestGinMiddlewareRecordsMethod(t *testing.T) {
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
				if method, ok := metadata["method"]; ok && method == "POST" {
					methodCaptured.Store(true)
				}
			}

			w.WriteHeader(http.StatusOK)
			w.Write([]byte(`{"ingested": 1}`))
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

	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(Middleware(client))

	router.POST("/api/data", func(c *gin.Context) {
		c.JSON(http.StatusCreated, gin.H{"created": true})
	})

	req := httptest.NewRequest("POST", "/api/data", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	time.Sleep(200 * time.Millisecond)

	if !methodCaptured.Load() {
		t.Error("POST method not captured")
	}
}

func TestGinMiddlewareRecordsDuration(t *testing.T) {
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

	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(Middleware(client))

	router.GET("/api/slow", func(c *gin.Context) {
		time.Sleep(10 * time.Millisecond)
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	req := httptest.NewRequest("GET", "/api/slow", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	time.Sleep(200 * time.Millisecond)

	if !durationRecorded.Load() {
		t.Error("duration not recorded")
	}
}

func TestGinMiddlewareMultipleRequests(t *testing.T) {
	var requestCount atomic.Int32

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/api/sdk/ingest" {
			var payload map[string]interface{}
			body, _ := io.ReadAll(r.Body)
			json.Unmarshal(body, &payload)

			events, ok := payload["events"].([]interface{})
			if ok {
				requestCount.Add(int32(len(events)))
			}

			w.WriteHeader(http.StatusOK)
			w.Write([]byte(fmt.Sprintf(`{"ingested": %d}`, len(events))))
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

	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(Middleware(client))

	router.GET("/api/test", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	// Make multiple requests
	for i := 0; i < 3; i++ {
		req := httptest.NewRequest("GET", "/api/test", nil)
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)
	}

	time.Sleep(300 * time.Millisecond)

	if requestCount.Load() < 3 {
		t.Errorf("expected at least 3 events tracked, got %d", requestCount.Load())
	}
}

func TestGinMiddlewareWithError(t *testing.T) {
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
				if status, ok := metadata["statusCode"]; ok {
					if status.(float64) == 500 {
						statusCodeCaptured.Store(true)
					}
				}
			}

			w.WriteHeader(http.StatusOK)
			w.Write([]byte(`{"ingested": 1}`))
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

	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(Middleware(client))

	router.GET("/api/error", func(c *gin.Context) {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error"})
	})

	req := httptest.NewRequest("GET", "/api/error", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	time.Sleep(200 * time.Millisecond)

	if !statusCodeCaptured.Load() {
		t.Error("500 status code not captured")
	}
}
