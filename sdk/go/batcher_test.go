package fathom

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

func TestBatcherEnqueue(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"ingested": 1}`))
	}))
	defer server.Close()

	transport := NewTransport("sk_test", server.URL, nil, nil)
	batcher := NewBatcher(transport, 10, 100*time.Millisecond, nil)
	batcher.Start()
	defer batcher.Stop()

	event := &SdkEvent{
		Type:     "test",
		Title:    "Test Event",
		Severity: "info",
	}

	batcher.Enqueue(event)

	// The batcher goroutine needs a moment to pick up the event from the channel.
	time.Sleep(50 * time.Millisecond)

	// Check size increased
	if batcher.Size() == 0 {
		t.Error("event not enqueued")
	}
}

func TestBatcherFlushOnSize(t *testing.T) {
	flushCount := 0
	mu := &sync.Mutex{}

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var payload map[string]interface{}
		body, _ := io.ReadAll(r.Body)
		json.Unmarshal(body, &payload)

		events, _ := payload["events"].([]interface{})
		mu.Lock()
		if len(events) == 3 {
			flushCount++
		}
		mu.Unlock()

		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"ingested": 1}`))
	}))
	defer server.Close()

	transport := NewTransport("sk_test", server.URL, nil, nil)
	batcher := NewBatcher(transport, 3, 10*time.Second, nil)
	batcher.Start()
	defer batcher.Stop()

	// Add exactly batch size events
	for i := 0; i < 3; i++ {
		batcher.Enqueue(&SdkEvent{
			Type:     "test",
			Title:    "Event",
			Severity: "info",
		})
	}

	// Wait for flush to occur
	time.Sleep(200 * time.Millisecond)

	mu.Lock()
	if flushCount == 0 {
		t.Error("batch not flushed when size reached")
	}
	mu.Unlock()
}

func TestBatcherFlushOnTimer(t *testing.T) {
	flushCount := 0
	mu := &sync.Mutex{}

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var payload map[string]interface{}
		body, _ := io.ReadAll(r.Body)
		json.Unmarshal(body, &payload)

		mu.Lock()
		flushCount++
		mu.Unlock()

		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"ingested": 1}`))
	}))
	defer server.Close()

	transport := NewTransport("sk_test", server.URL, nil, nil)
	batcher := NewBatcher(transport, 100, 100*time.Millisecond, nil)
	batcher.Start()
	defer batcher.Stop()

	// Add one event (less than batch size)
	batcher.Enqueue(&SdkEvent{
		Type:     "test",
		Title:    "Event",
		Severity: "info",
	})

	// Wait for timer to trigger flush
	time.Sleep(300 * time.Millisecond)

	mu.Lock()
	if flushCount == 0 {
		t.Error("batch not flushed on timer")
	}
	mu.Unlock()
}

func TestBatcherFailureRequeue(t *testing.T) {
	attemptCount := 0
	mu := &sync.Mutex{}

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		mu.Lock()
		attemptCount++
		mu.Unlock()

		// Fail first attempt, succeed second
		mu.Lock()
		if attemptCount <= 1 {
			mu.Unlock()
			w.WriteHeader(http.StatusInternalServerError)
			w.Write([]byte("error"))
			return
		}
		mu.Unlock()

		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"ingested": 1}`))
	}))
	defer server.Close()

	transport := NewTransport("sk_test", server.URL, nil, nil)
	batcher := NewBatcher(transport, 10, 100*time.Millisecond, nil)
	batcher.Start()
	defer batcher.Stop()

	batcher.Enqueue(&SdkEvent{
		Type:     "test",
		Title:    "Event",
		Severity: "info",
	})

	// Wait for retries
	time.Sleep(1 * time.Second)

	// Event should have been re-queued and retried
	mu.Lock()
	if attemptCount < 2 {
		t.Error("event not retried after failure")
	}
	mu.Unlock()
}

func TestBatcherSize(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"ingested": 1}`))
	}))
	defer server.Close()

	transport := NewTransport("sk_test", server.URL, nil, nil)
	batcher := NewBatcher(transport, 100, 5*time.Second, nil)
	batcher.Start()
	defer batcher.Stop()

	if batcher.Size() != 0 {
		t.Error("initial size should be 0")
	}

	batcher.Enqueue(&SdkEvent{
		Type:     "test",
		Title:    "Event",
		Severity: "info",
	})

	time.Sleep(50 * time.Millisecond)

	if batcher.Size() != 1 {
		t.Errorf("expected size 1, got %d", batcher.Size())
	}
}

func TestBatcherFlushSync(t *testing.T) {
	flushCount := int32(0)

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		atomic.AddInt32(&flushCount, 1)
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"ingested": 1}`))
	}))
	defer server.Close()

	transport := NewTransport("sk_test", server.URL, nil, nil)
	batcher := NewBatcher(transport, 10, 5*time.Second, nil)
	batcher.Start()

	// Add events
	for i := 0; i < 3; i++ {
		batcher.Enqueue(&SdkEvent{
			Type:     "test",
			Title:    "Event",
			Severity: "info",
		})
	}

	// Sync flush
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	err := batcher.FlushSync(ctx)
	if err != nil {
		t.Errorf("flush sync failed: %v", err)
	}

	batcher.Stop()

	if atomic.LoadInt32(&flushCount) == 0 {
		t.Error("no flush occurred during flush sync")
	}
}

func TestBatcherConcurrency(t *testing.T) {
	eventCount := int32(0)

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

	transport := NewTransport("sk_test", server.URL, nil, nil)
	batcher := NewBatcher(transport, 5, 100*time.Millisecond, nil)
	batcher.Start()
	defer batcher.Stop()

	// Enqueue from multiple goroutines
	wg := &sync.WaitGroup{}
	for i := 0; i < 10; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			for j := 0; j < 5; j++ {
				batcher.Enqueue(&SdkEvent{
					Type:     "test",
					Title:    "Event",
					Severity: "info",
				})
			}
		}(i)
	}

	wg.Wait()

	// Wait for flushes
	time.Sleep(500 * time.Millisecond)

	if atomic.LoadInt32(&eventCount) < 50 {
		t.Errorf("expected at least 50 events flushed, got %d", eventCount)
	}
}
