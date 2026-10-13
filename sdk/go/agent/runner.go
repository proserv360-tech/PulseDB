package agent

import (
	"context"
	"database/sql"
	"sync"
	"time"
)

// Runner coordinates the lifecycle of the configured collectors. It owns
// the timers, the shutdown context, and the forwarding goroutine.
//
// Implementation note: Runner is split from the cmd entrypoint so callers
// (tests, embedded uses) can drive it without spawning a process.
type Runner struct {
	Cfg     Config
	DB      *sql.DB
	Forward Forwarder // injected — typically wraps fathom.Transport

	stopOnce sync.Once
	stop     chan struct{}
}

// Forwarder is the agent's transport abstraction. The default
// implementation in cmd/fathom-agent wraps fathom.Transport so this
// package stays free of SDK imports (and therefore easy to unit-test).
type Forwarder interface {
	SendWaitEvents(ctx context.Context, samples []any) error
	SendQueryStats(ctx context.Context, stats []any) error
}

// NewRunner constructs a Runner. Validate cfg before calling.
func NewRunner(cfg Config, db *sql.DB, fwd Forwarder) *Runner {
	return &Runner{
		Cfg:     cfg,
		DB:      db,
		Forward: fwd,
		stop:    make(chan struct{}),
	}
}

// Run blocks until Stop is called or ctx is cancelled. It launches one
// ticker per cadence configured in Cfg.
func (r *Runner) Run(ctx context.Context) error {
	waitTick := time.NewTicker(r.Cfg.WaitEventInterval())
	defer waitTick.Stop()
	statsTick := time.NewTicker(r.Cfg.QueryStatsInterval())
	defer statsTick.Stop()

	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-r.stop:
			return nil
		case <-waitTick.C:
			r.collectWaitEvents(ctx)
		case <-statsTick.C:
			r.collectQueryStats(ctx)
		}
	}
}

// Stop signals the Run loop to exit cleanly. Safe to call multiple times.
func (r *Runner) Stop() {
	r.stopOnce.Do(func() { close(r.stop) })
}

// collectWaitEvents is intentionally permissive — sample failures must
// never bring the runner down. A persistent failure surfaces in the
// backend as a gap in the wait_event_rollups_5m table.
func (r *Runner) collectWaitEvents(ctx context.Context) {
	// Stub — wired in cmd/fathom-agent where the collector type is in
	// scope. Keeping the runner package free of the collector import
	// keeps test seams clean.
}

// collectQueryStats stub — same rationale as collectWaitEvents above.
func (r *Runner) collectQueryStats(ctx context.Context) {}
