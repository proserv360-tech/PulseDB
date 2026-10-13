package main

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/fathom/fathom-go"
	fathomgin "github.com/fathom/fathom-go/middleware/gin"
	"github.com/gin-gonic/gin"
)

func main() {
	// Initialize Fathom SDK
	client, err := fathom.New(fathom.Config{
		APIKey:        "sk_live_test123",
		Endpoint:      "http://localhost:3000",
		AppName:       "gin-example",
		Environment:   "development",
		BatchSize:     50,
		FlushInterval: 5 * time.Second,
		Debug:         true,
	})
	if err != nil {
		log.Fatal(err)
	}
	defer client.Shutdown(context.Background())

	// Create Gin router
	router := gin.Default()

	// Use Fathom middleware
	router.Use(fathomgin.Middleware(client))

	// Define routes
	router.GET("/", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"message": "Hello, World!",
		})
	})

	router.GET("/api/users", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"users": []map[string]interface{}{
				{"id": 1, "name": "Alice"},
				{"id": 2, "name": "Bob"},
			},
		})
	})

	router.GET("/error", func(c *gin.Context) {
		c.JSON(500, gin.H{
			"error": "Internal Server Error",
		})
	})

	router.POST("/api/data", func(c *gin.Context) {
		c.JSON(201, gin.H{
			"status": "created",
		})
	})

	// Track custom events
	go func() {
		time.Sleep(100 * time.Millisecond)

		// Track a custom event
		client.Track("custom_event", "User Registration", "info", map[string]interface{}{
			"userId": "user456",
			"email": "user@example.com",
		}, []string{"registration", "new_user"})

		// Track an audit event
		client.TrackAudit("Database Migration", fathom.AuditOpts{
			Message: "Executed migration v001_create_users_table",
			Severity: "info",
		})

		// Track a metric
		client.TrackMetric("Database Query Time", 78.5, "ms", map[string]interface{}{
			"query": "SELECT * FROM users",
		})

		// Track an error with context
		testErr := fmt.Errorf("failed to fetch user: record not found")
		client.TrackError(testErr, map[string]interface{}{
			"userId": "user789",
			"endpoint": "/api/users/789",
		})

		// Send heartbeat
		client.Heartbeat(context.Background(), "healthy", map[string]interface{}{
			"activeConnections": 5,
			"uptime": "2h30m",
		})
	}()

	// Start server
	log.Println("Starting Gin server on http://localhost:8081")
	log.Println("Try: curl http://localhost:8081/")
	log.Println("     curl http://localhost:8081/api/users")
	log.Println("     curl -X POST http://localhost:8081/api/data")
	log.Println("     curl http://localhost:8081/error")

	router.Run(":8081")
}
