package fathom

import (
	"context"
	"sync"
	"time"
)

// Batcher handles background event batching and flushing
type Batcher struct {
	transport       *Transport
	batchSize       int
	flushInterval   time.Duration
	logger          Logger
	eventChan       chan *SdkEvent
	flushSignal     chan struct{}
	stopSignal      chan struct{}
	queue           []*SdkEvent
	mu              sync.Mutex
	flushTicker     *time.Ticker
	goroutineActive bool
	wg              sync.WaitGroup
}

// NewBatcher creates a new event batcher
func NewBatcher(transport *Transport, batchSize int, flushInterval time.Duration, logger Logger) *Batcher {
	return &Batcher{
		transport:     transport,
		batchSize:     batchSize,
		flushInterval: flushInterval,
		logger:        logger,
		eventChan:     make(chan *SdkEvent, batchSize*2),
		flushSignal:   make(chan struct{}, 1),
		stopSignal:    make(chan struct{}),
		queue:         make([]*SdkEvent, 0, batchSize*2),
	}
}

// Start begins the background flush goroutine
func (b *Batcher) Start() {
	b.mu.Lock()
	defer b.mu.Unlock()

	if b.goroutineActive {
		return
	}

	b.flushTicker = time.NewTicker(b.flushInterval)
	b.goroutineActive = true

	b.wg.Add(1)
	go b.run()
}

// run is the main background goroutine loop
func (b *Batcher) run() {
	defer b.wg.Done()

	for {
		select {
		case event := <-b.eventChan:
			// Add event to queue
			b.mu.Lock()
			b.queue = append(b.queue, event)
			qlen := len(b.queue)
			b.mu.Unlock()

			b.logf("[Queue] Event added (%d/%d)", qlen, b.batchSize)

			// Check if batch size reached
			if qlen >= b.batchSize {
				b.flushBatch(context.Background())
			}

		case <-b.flushTicker.C:
			// Timer tick
			b.mu.Lock()
			qlen := len(b.queue)
			b.mu.Unlock()

			if qlen > 0 {
				b.flushBatch(context.Background())
			}

		case <-b.flushSignal:
			// Explicit flush signal
			b.flushBatch(context.Background())

		case <-b.stopSignal:
			// Shutdown signal
			b.logf("[Batcher] Stop signal received")
			return
		}
	}
}

// Enqueue adds an event to the queue
func (b *Batcher) Enqueue(event *SdkEvent) {
	select {
	case b.eventChan <- event:
		// Event queued
	case <-b.stopSignal:
		b.logf("[Enqueue] SDK shutting down, event dropped")
	}
}

// flushBatch sends a batch of events to FATHOM
// On failure, re-queues at front of queue
// If queue is full, drops oldest event (bounded memory)
func (b *Batcher) flushBatch(ctx context.Context) {
	b.mu.Lock()
	if len(b.queue) == 0 {
		b.mu.Unlock()
		return
	}

	// Take up to batchSize events
	batchLen := b.batchSize
	if len(b.queue) < batchLen {
		batchLen = len(b.queue)
	}

	batch := make([]*SdkEvent, batchLen)
	copy(batch, b.queue[:batchLen])
	b.queue = b.queue[batchLen:]

	b.mu.Unlock()

	b.logf("[Flush] Sending %d events to FATHOM", len(batch))

	// Send batch
	_, err := b.transport.PostIngest(ctx, batch)
	if err != nil {
		b.logf("[ERROR] Flush failed: %v", err)

		// Re-queue at front
		b.mu.Lock()
		b.queue = append(batch, b.queue...)

		// If queue is now too large (> batchSize * 4), drop oldest event
		maxSize := b.batchSize * 4
		if len(b.queue) > maxSize {
			b.logf("[WARN] Queue exceeds max size, dropping oldest event")
			b.queue = b.queue[1:]
		}

		b.mu.Unlock()
		return
	}

	b.logf("[Flush] Success")
}

// Stop gracefully stops the batcher
func (b *Batcher) Stop() {
	// Swap the active flag under the lock, but release it before
	// close()/wg.Wait() so the goroutine can still acquire b.mu to
	// finish in-flight work and observe the stop signal.
	b.mu.Lock()
	if !b.goroutineActive {
		b.mu.Unlock()
		return
	}
	b.goroutineActive = false
	if b.flushTicker != nil {
		b.flushTicker.Stop()
	}
	b.mu.Unlock()

	close(b.stopSignal)
	b.wg.Wait()

	// Drain any events still sitting in eventChan into the queue so a
	// subsequent FlushSync() can send them. Non-blocking drain only.
	for {
		select {
		case event := <-b.eventChan:
			b.mu.Lock()
			b.queue = append(b.queue, event)
			b.mu.Unlock()
		default:
			return
		}
	}
}

// FlushSync synchronously drains all remaining events
// Used during shutdown to ensure all events are sent
func (b *Batcher) FlushSync(ctx context.Context) error {
	// Drain the event channel
	for {
		select {
		case event := <-b.eventChan:
			b.mu.Lock()
			b.queue = append(b.queue, event)
			b.mu.Unlock()
		default:
			// Channel empty
			goto drainQueue
		}
	}

drainQueue:
	// Send all remaining events
	for {
		b.mu.Lock()
		if len(b.queue) == 0 {
			b.mu.Unlock()
			break
		}

		batchLen := b.batchSize
		if len(b.queue) < batchLen {
			batchLen = len(b.queue)
		}

		batch := make([]*SdkEvent, batchLen)
		copy(batch, b.queue[:batchLen])
		b.queue = b.queue[batchLen:]

		b.mu.Unlock()

		b.logf("[FlushSync] Sending %d events", len(batch))
		_, err := b.transport.PostIngest(ctx, batch)
		if err != nil {
			b.logf("[ERROR] FlushSync failed: %v", err)
			return err
		}
	}

	return nil
}

// Size returns the current queue size
func (b *Batcher) Size() int {
	b.mu.Lock()
	defer b.mu.Unlock()
	return len(b.queue)
}

// logf is a helper for logging
func (b *Batcher) logf(format string, args ...interface{}) {
	if b.logger != nil {
		b.logger.Debugf(format, args...)
	}
}
