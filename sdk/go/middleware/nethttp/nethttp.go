package nethttp

import (
	"net/http"
	"time"

	"github.com/fathom/fathom-go"
)

// SkipFunc is a function that returns true if the request should be skipped
type SkipFunc func(r *http.Request) bool

// Middleware returns an http.Handler middleware that tracks API calls
// It captures method, path, status code, and duration
// Usage:
//   handler := http.HandlerFunc(myHandler)
//   wrappedHandler := nethttp.Middleware(client)(handler)
func Middleware(client *fathom.Client) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Wrap response writer to capture status code
			wrapped := &responseWriter{ResponseWriter: w, statusCode: http.StatusOK}

			start := time.Now()

			// Call next handler
			next.ServeHTTP(wrapped, r)

			// Record timing
			duration := time.Since(start)
			durationMs := duration.Milliseconds()

			// Track API call
			client.TrackAPI(
				r.Method,
				r.RequestURI,
				wrapped.statusCode,
				durationMs,
				map[string]interface{}{
					"userAgent": r.Header.Get("User-Agent"),
					"remoteAddr": r.RemoteAddr,
					"contentType": r.Header.Get("Content-Type"),
				},
			)
		})
	}
}

// responseWriter wraps http.ResponseWriter to capture status code
type responseWriter struct {
	http.ResponseWriter
	statusCode int
	written    bool
}

// WriteHeader captures the status code
func (w *responseWriter) WriteHeader(statusCode int) {
	if !w.written {
		w.statusCode = statusCode
		w.written = true
		w.ResponseWriter.WriteHeader(statusCode)
	}
}

// Write ensures WriteHeader is called if not already called
func (w *responseWriter) Write(b []byte) (int, error) {
	if !w.written {
		w.written = true
	}
	return w.ResponseWriter.Write(b)
}
