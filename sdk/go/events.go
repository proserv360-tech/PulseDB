package fathom

import (
	"crypto/rand"
	"fmt"
	"runtime"
	"strings"
	"time"
)

// SdkEvent represents a single event to be sent to FATHOM
// All fields use camelCase to match the server wire format exactly
type SdkEvent struct {
	Type        string                 `json:"type"`
	Title       string                 `json:"title"`
	Severity    string                 `json:"severity"`
	Message     string                 `json:"message,omitempty"`
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
	Timestamp   string                 `json:"timestamp"`
	SessionID   string                 `json:"sessionId"`
	AppName     string                 `json:"appName"`
	Environment string                 `json:"environment"`
	Tags        []string               `json:"tags,omitempty"`
}

// generateSessionID generates a session ID in format <millis>-<8-hex>
func generateSessionID() string {
	millis := time.Now().UnixMilli()

	// Generate 4 random bytes = 8 hex characters
	b := make([]byte, 4)
	if _, err := rand.Read(b); err != nil {
		// Fallback if random fails (shouldn't happen in practice)
		return fmt.Sprintf("%d-00000000", millis)
	}

	hexPart := fmt.Sprintf("%08x", b)
	return fmt.Sprintf("%d-%s", millis, hexPart)
}

// generateErrorTitle creates a title from an error or title string
func generateErrorTitle(err error) string {
	if err == nil {
		return "Error"
	}

	msg := err.Error()
	if len(msg) > 80 {
		msg = msg[:80]
	}
	return fmt.Sprintf("error: %s", msg)
}

// APIEvent creates an API tracking event with auto-severity mapping
func APIEvent(method, endpoint string, statusCode int, durationMs int64, metadata map[string]interface{}) *SdkEvent {
	if metadata == nil {
		metadata = make(map[string]interface{})
	}

	// Auto-map severity based on status code
	var severity string
	if statusCode >= 500 {
		severity = "error"
	} else if statusCode >= 400 {
		severity = "warning"
	} else {
		severity = "info"
	}

	// Build metadata
	fullMetadata := make(map[string]interface{})
	for k, v := range metadata {
		fullMetadata[k] = v
	}
	fullMetadata["method"] = method
	fullMetadata["endpoint"] = endpoint
	fullMetadata["statusCode"] = statusCode
	fullMetadata["durationMs"] = durationMs

	return &SdkEvent{
		Type:        "api",
		Title:       fmt.Sprintf("%s %s", method, endpoint),
		Severity:    severity,
		Message:     "",
		Metadata:    fullMetadata,
		Timestamp:   time.Now().UTC().Format(time.RFC3339),
	}
}

// ErrorEvent creates an error tracking event from an error
func ErrorEvent(err error, metadata map[string]interface{}) *SdkEvent {
	if metadata == nil {
		metadata = make(map[string]interface{})
	}

	errorMetadata := make(map[string]interface{})
	for k, v := range metadata {
		errorMetadata[k] = v
	}

	title := "Error"
	if err != nil {
		errType := fmt.Sprintf("%T", err)
		// Strip package name to get just the type name
		if idx := strings.LastIndex(errType, "."); idx >= 0 {
			errType = errType[idx+1:]
		}
		errMsg := err.Error()

		errorMetadata["name"] = errType
		errorMetadata["message"] = errMsg

		// Capture stack trace
		buf := make([]byte, 4096)
		n := runtime.Stack(buf, false)
		if n > 0 {
			errorMetadata["stack"] = string(buf[:n])
		}

		// Title format: "error: <msg first 80 chars>"
		if len(errMsg) > 80 {
			errMsg = errMsg[:80]
		}
		title = fmt.Sprintf("error: %s", errMsg)
	}

	return &SdkEvent{
		Type:        "error",
		Title:       title,
		Severity:    "error",
		Message:     "",
		Metadata:    errorMetadata,
		Timestamp:   time.Now().UTC().Format(time.RFC3339),
	}
}

// AuditEvent creates an audit tracking event
func AuditEvent(title string, message string, severity string, metadata map[string]interface{}) *SdkEvent {
	if metadata == nil {
		metadata = make(map[string]interface{})
	}

	fullMetadata := make(map[string]interface{})
	for k, v := range metadata {
		fullMetadata[k] = v
	}
	if message != "" {
		fullMetadata["message"] = message
	}

	if severity == "" {
		severity = "info"
	}

	return &SdkEvent{
		Type:        "audit",
		Title:       title,
		Severity:    severity,
		Message:     "",
		Metadata:    fullMetadata,
		Timestamp:   time.Now().UTC().Format(time.RFC3339),
	}
}

// MetricEvent creates a metric tracking event
func MetricEvent(title string, value float64, unit string, metadata map[string]interface{}) *SdkEvent {
	if metadata == nil {
		metadata = make(map[string]interface{})
	}

	fullMetadata := make(map[string]interface{})
	for k, v := range metadata {
		fullMetadata[k] = v
	}
	fullMetadata["value"] = value
	if unit != "" {
		fullMetadata["unit"] = unit
	}

	return &SdkEvent{
		Type:        "metric",
		Title:       title,
		Severity:    "info",
		Message:     "",
		Metadata:    fullMetadata,
		Timestamp:   time.Now().UTC().Format(time.RFC3339),
	}
}

// CustomEvent creates a custom tracking event
func CustomEvent(eventType, title, severity string, metadata map[string]interface{}, tags []string) *SdkEvent {
	if metadata == nil {
		metadata = make(map[string]interface{})
	}

	fullMetadata := make(map[string]interface{})
	for k, v := range metadata {
		fullMetadata[k] = v
	}
	if len(tags) > 0 {
		fullMetadata["tags"] = tags
	}

	return &SdkEvent{
		Type:        eventType,
		Title:       title,
		Severity:    severity,
		Message:     "",
		Metadata:    fullMetadata,
		Timestamp:   time.Now().UTC().Format(time.RFC3339),
		Tags:        tags,
	}
}
