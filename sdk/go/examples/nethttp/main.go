package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/fathom/fathom-go"
	"github.com/fathom/fathom-go/middleware/nethttp"
)

func main() {
	// Initialize Fathom SDK
	client, err := fathom.New(fathom.Config{
		APIKey:        "sk_live_test123",
		Endpoint:      "http://localhost:3000",
		AppName:       "nethttp-example",
		Environment:   "development",
		BatchSize:     50,
		FlushInterval: 5 * time.Second,
		Debug:         true,
	})
	if err != nil {
		log.Fatal(err)
	}
	defer client.Shutdown(context.Background())

	// Create a simple handler
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/":
			w.WriteHeader(http.StatusOK)
			w.Write([]byte("Hello, World!"))

		case "/error":
			w.WriteHeader(http.StatusInternalServerError)
			w.Write([]byte("Server Error"))

		case "/api/data":
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			w.Write([]byte(`{"data": "test"}`))

		default:
			w.WriteHeader(http.StatusNotFound)
			w.Write([]byte("Not Found"))
		}
	})

	// Wrap handler with Fathom middleware
	wrappedHandler := nethttp.Middleware(client)(handler)

	// Also track custom events
	go func() {
		time.Sleep(100 * time.Millisecond)
		client.TrackAPI("GET", "/api/users", 200, 45, map[string]interface{}{
			"userId": "user123",
		})

		client.TrackAudit("User Login", fathom.AuditOpts{
			Message: "User successfully logged in",
			Severity: "info",
		})

		client.TrackMetric("API Response Time", 125.5, "ms", map[string]interface{}{
			"endpoint": "/api/users",
		})

		// Send a test error
		testErr := fmt.Errorf("test error: database connection failed")
		client.TrackError(testErr, map[string]interface{}{
			"service": "database",
		})

		// Send heartbeat
		client.Heartbeat(context.Background(), "healthy", map[string]interface{}{
			"requestCount": 42,
		})
	}()

	// Start server
	server := &http.Server{
		Addr:    ":8080",
		Handler: wrappedHandler,
	}

	log.Println("Starting server on http://localhost:8080")
	log.Println("Try: curl http://localhost:8080/")
	log.Println("     curl http://localhost:8080/api/data")
	log.Println("     curl http://localhost:8080/error")

	if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatal(err)
	}
}
