package gin

import (
	"time"

	"github.com/fathom/fathom-go"
	"github.com/gin-gonic/gin"
)

// Middleware returns a gin.HandlerFunc middleware that tracks API calls
// It captures method, path, status code, and duration
// Usage:
//   router := gin.Default()
//   router.Use(gin.Middleware(client))
func Middleware(client *fathom.Client) gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()

		// Call next handler
		c.Next()

		// Record timing
		duration := time.Since(start)
		durationMs := duration.Milliseconds()

		// Get status code from context
		statusCode := c.Writer.Status()

		// Track API call
		client.TrackAPI(
			c.Request.Method,
			c.Request.RequestURI,
			statusCode,
			durationMs,
			map[string]interface{}{
				"userAgent": c.Request.Header.Get("User-Agent"),
				"remoteAddr": c.ClientIP(),
				"contentType": c.Request.Header.Get("Content-Type"),
			},
		)
	}
}
