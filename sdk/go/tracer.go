package fathom

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"
)

// SpanKind represents the span kind in OTLP
type SpanKind int32

const (
	SpanKindUnspecified SpanKind = 0
	SpanKindInternal    SpanKind = 1
	SpanKindServer      SpanKind = 2
	SpanKindClient      SpanKind = 3
	SpanKindProducer    SpanKind = 4
	SpanKindConsumer    SpanKind = 5
)

// StatusCode represents OTLP status code
type StatusCode int32

const (
	StatusCodeUnset StatusCode = 0
	StatusCodeOK    StatusCode = 1
	StatusCodeError StatusCode = 2
)

// Span represents a single span in a trace
type Span struct {
	mu                sync.RWMutex
	TraceID           string
	SpanID            string
	ParentSpanID      string
	Name              string
	Kind              SpanKind
	Attributes        map[string]interface{}
	Exceptions        []map[string]string
	StartTimeUnixNano int64
	EndTimeUnixNano   int64
	StatusCode        StatusCode
	StatusMessage     string
	Ended             bool
}

// NewSpan creates a new span
func NewSpan(traceID, spanID, name string, kind SpanKind) *Span {
	return &Span{
		TraceID:           traceID,
		SpanID:            spanID,
		Name:              name,
		Kind:              kind,
		Attributes:        make(map[string]interface{}),
		Exceptions:        []map[string]string{},
		StartTimeUnixNano: time.Now().UnixNano(),
		StatusCode:        StatusCodeUnset,
	}
}

// SetAttribute sets a span attribute
func (s *Span) SetAttribute(key string, value interface{}) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if !s.Ended {
		s.Attributes[key] = value
	}
}

// RecordException records an exception
func (s *Span) RecordException(err error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if !s.Ended {
		exc := map[string]string{
			"type":       fmt.Sprintf("%T", err),
			"message":    err.Error(),
			"stacktrace": fmt.Sprintf("%+v", err),
		}
		s.Exceptions = append(s.Exceptions, exc)
	}
}

// End ends the span
func (s *Span) End(opts *SpanOpts) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.Ended {
		return
	}

	s.Ended = true
	s.EndTimeUnixNano = time.Now().UnixNano()

	if opts != nil {
		if opts.Status == "error" {
			s.StatusCode = StatusCodeError
		} else if opts.Status == "ok" {
			s.StatusCode = StatusCodeOK
		}
		if opts.Message != "" {
			s.StatusMessage = opts.Message
		}
	}
}

// SpanOpts holds options for ending a span
type SpanOpts struct {
	Status  string
	Message string
}

// ToOtlpSpan converts span to OTLP format
func (s *Span) ToOtlpSpan() map[string]interface{} {
	s.mu.RLock()
	defer s.mu.RUnlock()

	attributes := []map[string]interface{}{}

	// Add regular attributes
	for key, value := range s.Attributes {
		attributes = append(attributes, map[string]interface{}{
			"key":   key,
			"value": attributeValue(value),
		})
	}

	// Add exception attributes if any
	if len(s.Exceptions) > 0 {
		exc := s.Exceptions[0]
		attributes = append(attributes, map[string]interface{}{
			"key":   "exception.type",
			"value": map[string]interface{}{"stringValue": exc["type"]},
		})
		attributes = append(attributes, map[string]interface{}{
			"key":   "exception.message",
			"value": map[string]interface{}{"stringValue": exc["message"]},
		})
		attributes = append(attributes, map[string]interface{}{
			"key":   "exception.stacktrace",
			"value": map[string]interface{}{"stringValue": exc["stacktrace"]},
		})
	}

	span := map[string]interface{}{
		"traceId":             s.TraceID,
		"spanId":              s.SpanID,
		"name":                s.Name,
		"kind":                int32(s.Kind),
		"startTimeUnixNano":   fmt.Sprintf("%d", s.StartTimeUnixNano),
		"endTimeUnixNano":     fmt.Sprintf("%d", s.EndTimeUnixNano),
		"status": map[string]interface{}{
			"code":    int32(s.StatusCode),
			"message": s.StatusMessage,
		},
	}

	if s.ParentSpanID != "" {
		span["parentSpanId"] = s.ParentSpanID
	}

	if len(attributes) > 0 {
		span["attributes"] = attributes
	}

	return span
}

// attributeValue converts value to OTLP attribute format
func attributeValue(value interface{}) map[string]interface{} {
	switch v := value.(type) {
	case string:
		return map[string]interface{}{"stringValue": v}
	case bool:
		return map[string]interface{}{"boolValue": v}
	case int, int32, int64:
		return map[string]interface{}{"intValue": fmt.Sprintf("%d", v)}
	case float64, float32:
		return map[string]interface{}{"doubleValue": v}
	default:
		return map[string]interface{}{"stringValue": fmt.Sprintf("%v", v)}
	}
}

// contextKey is used for storing active span in context
type contextKey int

const activeSpanKey contextKey = 0

// Tracer provides tracing functionality
type Tracer struct {
	client *Client
	mu     sync.RWMutex
}

// NewTracer creates a new tracer
func NewTracer(client *Client) *Tracer {
	return &Tracer{client: client}
}

// StartSpan starts a new span with automatic parent detection
func (t *Tracer) StartSpan(ctx context.Context, name string, opts *SpanOpts) (context.Context, *Span) {
	// Detect parent span from context
	var traceID, parentSpanID string
	if parent, ok := ctx.Value(activeSpanKey).(*Span); ok {
		// Inherit trace ID from parent
		traceID = parent.TraceID
		parentSpanID = parent.SpanID
	} else {
		// Generate new trace ID
		traceIDBytes := make([]byte, 16)
		rand.Read(traceIDBytes)
		traceID = hex.EncodeToString(traceIDBytes)
	}

	// Always generate new span ID
	spanIDBytes := make([]byte, 8)
	rand.Read(spanIDBytes)
	spanID := hex.EncodeToString(spanIDBytes)

	kind := SpanKindInternal
	if opts != nil && opts.Status != "" {
		// opts.Status can override kind if needed (advanced usage)
	}

	span := NewSpan(traceID, spanID, name, kind)
	span.ParentSpanID = parentSpanID

	// Store span in context
	newCtx := context.WithValue(ctx, activeSpanKey, span)

	return newCtx, span
}

// InjectHeaders injects W3C traceparent header
func (t *Tracer) InjectHeaders(header http.Header, span *Span) {
	if span == nil {
		return
	}
	// Format: 00-<trace>-<span>-01
	traceparent := fmt.Sprintf("00-%s-%s-01", span.TraceID, span.SpanID)
	header.Set("traceparent", traceparent)
}

// ExtractContext extracts trace context from W3C traceparent header
func (t *Tracer) ExtractContext(header http.Header) map[string]string {
	traceparent := header.Get("traceparent")
	if traceparent == "" {
		traceparent = header.Get("Traceparent")
	}

	if traceparent == "" {
		return nil
	}

	parts := strings.Split(traceparent, "-")
	if len(parts) != 4 || parts[0] != "00" {
		return nil
	}

	return map[string]string{
		"traceId": parts[1],
		"spanId":  parts[2],
		"flags":   parts[3],
	}
}

// GetActiveSpan returns the active span from context
func GetActiveSpan(ctx context.Context) *Span {
	if span, ok := ctx.Value(activeSpanKey).(*Span); ok {
		return span
	}
	return nil
}

// WithSpan executes a callback with span as active context
func (t *Tracer) WithSpan(ctx context.Context, span *Span, fn func(context.Context) error) error {
	newCtx := context.WithValue(ctx, activeSpanKey, span)
	err := fn(newCtx)

	if err != nil {
		span.RecordException(err)
		span.End(&SpanOpts{Status: "error"})
	} else {
		span.End(&SpanOpts{Status: "ok"})
	}

	return err
}
