// Package postgres implements the Postgres collectors used by the FATHOM
// managed agent. Each collector exposes a Sample method that returns a
// batch of observations the agent forwards via the existing SDK Transport.
package postgres

import (
	"context"
	"database/sql"
	"time"
)

// WaitEventSample is one row from pg_stat_activity captured by the agent.
// Field names mirror the backend schema (wait_event_samples) so the
// backend can de-serialise without translation.
type WaitEventSample struct {
	SampledAt       time.Time `json:"sampled_at"`
	PID             int       `json:"pid"`
	State           *string   `json:"state,omitempty"`
	WaitEventType   *string   `json:"wait_event_type,omitempty"`
	WaitEvent       *string   `json:"wait_event,omitempty"`
	QueryID         *int64    `json:"query_id,omitempty"`
	BackendType     *string   `json:"backend_type,omitempty"`
	ApplicationName *string   `json:"application_name,omitempty"`
}

// WaitEventCollector polls pg_stat_activity at a fixed cadence and
// returns the non-idle backends as WaitEventSamples.
type WaitEventCollector struct {
	DB *sql.DB
}

// NewWaitEventCollector constructs a collector bound to the supplied DB
// handle. The caller owns the *sql.DB lifecycle.
func NewWaitEventCollector(db *sql.DB) *WaitEventCollector {
	return &WaitEventCollector{DB: db}
}

const waitEventSQL = `
SELECT pid, state, wait_event_type, wait_event,
       query_id, backend_type, application_name
  FROM pg_stat_activity
 WHERE pid <> pg_backend_pid()
   AND state IS NOT NULL
   AND state <> 'idle'
`

// Sample collects one snapshot. Context cancellation aborts the read.
// Returns (samples, error). On error, samples may still be partial — the
// caller should decide whether to forward or drop.
func (c *WaitEventCollector) Sample(ctx context.Context) ([]WaitEventSample, error) {
	rows, err := c.DB.QueryContext(ctx, waitEventSQL)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	now := time.Now().UTC()
	out := make([]WaitEventSample, 0, 32)
	for rows.Next() {
		var s WaitEventSample
		s.SampledAt = now
		if err := rows.Scan(
			&s.PID, &s.State, &s.WaitEventType, &s.WaitEvent,
			&s.QueryID, &s.BackendType, &s.ApplicationName,
		); err != nil {
			return out, err
		}
		out = append(out, s)
	}
	return out, rows.Err()
}
