package fathom

import (
	"context"
	"fmt"
	"net/http"
	"sync/atomic"
	"testing"
)

func TestSpanCreation(t *testing.T) {
	span := NewSpan("trace1", "span1", "test-op", SpanKindInternal)

	if span.TraceID != "trace1" {
		t.Errorf("Expected traceID=trace1, got %s", span.TraceID)
	}
	if span.SpanID != "span1" {
		t.Errorf("Expected spanID=span1, got %s", span.SpanID)
	}
	if span.Name != "test-op" {
		t.Errorf("Expected name=test-op, got %s", span.Name)
	}
	if span.Kind != SpanKindInternal {
		t.Errorf("Expected kind=1, got %d", span.Kind)
	}
	if span.Ended {
		t.Error("Expected ended=false")
	}
	if span.StatusCode != StatusCodeUnset {
		t.Error("Expected status=UNSET")
	}
}

func TestSetAttribute(t *testing.T) {
	span := NewSpan("trace1", "span1", "op", SpanKindInternal)

	span.SetAttribute("user.id", "u123")
	span.SetAttribute("http.method", "GET")

	if val, ok := span.Attributes["user.id"]; !ok || val != "u123" {
		t.Error("Failed to set attribute user.id")
	}
	if val, ok := span.Attributes["http.method"]; !ok || val != "GET" {
		t.Error("Failed to set attribute http.method")
	}
}

func TestRecordException(t *testing.T) {
	span := NewSpan("trace1", "span1", "op", SpanKindInternal)

	err := fmt.Errorf("test error")
	span.RecordException(err)

	if len(span.Exceptions) != 1 {
		t.Errorf("Expected 1 exception, got %d", len(span.Exceptions))
	}
	if span.Exceptions[0]["message"] != "test error" {
		t.Errorf("Expected message='test error', got %s", span.Exceptions[0]["message"])
	}
}

func TestSpanEnd(t *testing.T) {
	span := NewSpan("trace1", "span1", "op", SpanKindInternal)

	if span.EndTimeUnixNano != 0 {
		t.Error("Expected endTimeUnixNano=0 before end")
	}

	span.End(&SpanOpts{Status: "error"})

	if !span.Ended {
		t.Error("Expected ended=true after end")
	}
	if span.EndTimeUnixNano == 0 {
		t.Error("Expected endTimeUnixNano > 0 after end")
	}
	if span.StatusCode != StatusCodeError {
		t.Error("Expected status=ERROR")
	}
}

func TestSpanEndIdempotent(t *testing.T) {
	span := NewSpan("trace1", "span1", "op", SpanKindInternal)

	span.End(&SpanOpts{Status: "ok"})
	firstEndTime := span.EndTimeUnixNano

	span.End(&SpanOpts{Status: "error"})
	secondEndTime := span.EndTimeUnixNano

	if firstEndTime != secondEndTime {
		t.Error("end() should be idempotent")
	}
}

func TestToOtlpSpan(t *testing.T) {
	span := NewSpan("trace1", "span1", "test-op", SpanKindServer)
	span.ParentSpanID = "parent1"
	span.SetAttribute("user.id", "u123")
	span.End(&SpanOpts{Status: "ok"})

	otlp := span.ToOtlpSpan()

	if otlp["traceId"] != "trace1" {
		t.Error("OTLP traceId mismatch")
	}
	if otlp["spanId"] != "span1" {
		t.Error("OTLP spanId mismatch")
	}
	if otlp["parentSpanId"] != "parent1" {
		t.Error("OTLP parentSpanId mismatch")
	}
	if otlp["name"] != "test-op" {
		t.Error("OTLP name mismatch")
	}
	if otlp["kind"] != int32(SpanKindServer) {
		t.Error("OTLP kind mismatch")
	}

	status := otlp["status"].(map[string]interface{})
	if status["code"] != int32(StatusCodeOK) {
		t.Error("OTLP status code should be OK")
	}
}

func TestTracerStartSpan(t *testing.T) {
	mockClient := &Client{config: Config{AppName: "test"}, logger: &defaultLogger{debug: false}}
	tracer := NewTracer(mockClient)

	ctx := context.Background()
	newCtx, span := tracer.StartSpan(ctx, "test-op", nil)

	if span.Name != "test-op" {
		t.Errorf("Expected span name=test-op, got %s", span.Name)
	}
	if span.TraceID == "" {
		t.Error("Expected traceID to be generated")
	}
	if span.SpanID == "" {
		t.Error("Expected spanID to be generated")
	}
	if len(span.TraceID) != 32 {
		t.Errorf("Expected traceID length=32, got %d", len(span.TraceID))
	}
	if len(span.SpanID) != 16 {
		t.Errorf("Expected spanID length=16, got %d", len(span.SpanID))
	}

	// Verify context has span
	if GetActiveSpan(newCtx) != span {
		t.Error("Expected span to be in context")
	}
}

func TestTracerStartSpanDetectsParent(t *testing.T) {
	mockClient := &Client{config: Config{AppName: "test"}, logger: &defaultLogger{debug: false}}
	tracer := NewTracer(mockClient)

	ctx := context.Background()
	_, parentSpan := tracer.StartSpan(ctx, "parent", nil)

	ctxWithParent := context.WithValue(ctx, activeSpanKey, parentSpan)
	_, childSpan := tracer.StartSpan(ctxWithParent, "child", nil)

	if childSpan.ParentSpanID != parentSpan.SpanID {
		t.Error("Child span should have parent spanID")
	}
	if childSpan.TraceID != parentSpan.TraceID {
		t.Error("Child span should inherit trace ID from parent")
	}
}

func TestInjectHeaders(t *testing.T) {
	mockClient := &Client{config: Config{AppName: "test"}, logger: &defaultLogger{debug: false}}
	tracer := NewTracer(mockClient)

	ctx := context.Background()
	_, span := tracer.StartSpan(ctx, "op", nil)

	headers := http.Header{}
	tracer.InjectHeaders(headers, span)

	if headers.Get("traceparent") == "" {
		t.Error("Expected traceparent header to be set")
	}

	traceparent := headers.Get("traceparent")
	expected := fmt.Sprintf("00-%s-%s-01", span.TraceID, span.SpanID)
	if traceparent != expected {
		t.Errorf("Expected traceparent=%s, got %s", expected, traceparent)
	}
}

func TestExtractContext(t *testing.T) {
	mockClient := &Client{config: Config{AppName: "test"}, logger: &defaultLogger{debug: false}}
	tracer := NewTracer(mockClient)

	headers := http.Header{}
	headers.Set("traceparent", "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01")

	ctx := tracer.ExtractContext(headers)

	if ctx == nil {
		t.Error("Expected context to be extracted")
	}
	if ctx["traceId"] != "4bf92f3577b34da6a3ce929d0e0e4736" {
		t.Error("Expected traceId match")
	}
	if ctx["spanId"] != "00f067aa0ba902b7" {
		t.Error("Expected spanId match")
	}
	if ctx["flags"] != "01" {
		t.Error("Expected flags match")
	}
}

func TestExtractContextMissing(t *testing.T) {
	mockClient := &Client{config: Config{AppName: "test"}, logger: &defaultLogger{debug: false}}
	tracer := NewTracer(mockClient)

	headers := http.Header{}
	ctx := tracer.ExtractContext(headers)

	if ctx != nil {
		t.Error("Expected nil context when traceparent is missing")
	}
}

func TestWithSpan(t *testing.T) {
	mockClient := &Client{config: Config{AppName: "test"}, logger: &defaultLogger{debug: false}}
	tracer := NewTracer(mockClient)

	ctx := context.Background()
	_, span := tracer.StartSpan(ctx, "op", nil)

	var called atomic.Bool
	err := tracer.WithSpan(ctx, span, func(c context.Context) error {
		called.Store(true)
		if GetActiveSpan(c) != span {
			t.Error("Expected span to be in context within WithSpan")
		}
		return nil
	})

	if err != nil {
		t.Errorf("Unexpected error: %v", err)
	}
	if !called.Load() {
		t.Error("Expected callback to be called")
	}
	if !span.Ended {
		t.Error("Expected span to be ended after WithSpan")
	}
}

func TestWithSpanError(t *testing.T) {
	mockClient := &Client{config: Config{AppName: "test"}, logger: &defaultLogger{debug: false}}
	tracer := NewTracer(mockClient)

	ctx := context.Background()
	_, span := tracer.StartSpan(ctx, "op", nil)

	testErr := fmt.Errorf("test error")
	err := tracer.WithSpan(ctx, span, func(c context.Context) error {
		return testErr
	})

	if err != testErr {
		t.Errorf("Expected error to be returned: %v", err)
	}
	if !span.Ended {
		t.Error("Expected span to be ended after WithSpan error")
	}
	if span.StatusCode != StatusCodeError {
		t.Error("Expected status to be ERROR after error")
	}
	if len(span.Exceptions) == 0 {
		t.Error("Expected exception to be recorded")
	}
}

func TestAttributeValue(t *testing.T) {
	tests := []struct {
		value    interface{}
		expected string
	}{
		{"hello", "stringValue"},
		{42, "intValue"},
		{3.14, "doubleValue"},
		{true, "boolValue"},
	}

	for _, test := range tests {
		result := attributeValue(test.value)
		if _, ok := result[test.expected]; !ok {
			t.Errorf("Expected %s for value %v", test.expected, test.value)
		}
	}
}
