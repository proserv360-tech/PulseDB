package main

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/pulsedb/pulsedb-go"
)

// sdkForwarder satisfies agent.Forwarder using the existing pulsedb.Transport.
// It POSTs to the agent ingest endpoints introduced for C1:
//
//   POST /api/agent/wait-events   { samples: [...] }
//   POST /api/agent/query-stats   { stats:   [...] }
//
// Auth is the standard x-sdk-key header.
type sdkForwarder struct {
	transport *pulsedb.Transport
	endpoint  string
	apiKey    string
}

func newSDKForwarder(apiKey, endpoint string) *sdkForwarder {
	t := pulsedb.NewTransport(apiKey, endpoint, nil, nil)
	return &sdkForwarder{transport: t, endpoint: endpoint, apiKey: apiKey}
}

func (f *sdkForwarder) SendWaitEvents(ctx context.Context, samples []any) error {
	return f.post(ctx, "/api/agent/wait-events", map[string]any{"samples": samples})
}

func (f *sdkForwarder) SendQueryStats(ctx context.Context, stats []any) error {
	return f.post(ctx, "/api/agent/query-stats", map[string]any{"stats": stats})
}

func (f *sdkForwarder) post(ctx context.Context, path string, payload any) error {
	// The agent shares Transport's retry envelope by reaching into the
	// underlying http.Client. We avoid duplicating the back-off and
	// circuit-breaker logic that lives in transport.go.
	body, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("marshal: %w", err)
	}
	// PostRaw isn't exported yet; once it is, switch from the in-package
	// helper to pulsedb.Transport.PostRaw(ctx, path, body).
	return f.transport.PostRaw(ctx, path, body)
}
