// Command pulsedb-agent is the PulseDB managed agent binary.
//
//   $ pulsedb-agent --config /etc/pulsedb/agent.yaml
//   $ pulsedb-agent --postgres-dsn postgres://... --api-key sk_live_... --endpoint https://app.pulsedb.dev
//
// Configuration precedence: defaults < agent.yaml < ENV < CLI flags.
//
// Wave C (C1) scope: scaffolding + Postgres collectors only. MySQL/Mongo
// collectors and the auto-update channel land in follow-up work.
package main

import (
	"context"
	"database/sql"
	"flag"
	"fmt"
	"log"
	"os"
	"os/signal"
	"syscall"

	"github.com/pulsedb/pulsedb-go/agent"
	_ "github.com/lib/pq"
)

func main() {
	cfg := agent.DefaultConfig()

	flag.StringVar(&cfg.APIKey,       "api-key",       cfg.APIKey,       "PulseDB API key (or PULSEDB_API_KEY)")
	flag.StringVar(&cfg.Endpoint,     "endpoint",      cfg.Endpoint,     "PulseDB endpoint (or PULSEDB_ENDPOINT)")
	flag.StringVar(&cfg.ConnectionID, "connection-id", cfg.ConnectionID, "PulseDB connection ID this agent represents")
	flag.StringVar(&cfg.PostgresDSN,  "postgres-dsn",  cfg.PostgresDSN,  "Postgres DSN to monitor (or PULSEDB_POSTGRES_DSN)")
	flag.IntVar(&cfg.WaitEventIntervalMs,  "wait-event-interval-ms",  cfg.WaitEventIntervalMs,  "Cadence for pg_stat_activity polling")
	flag.IntVar(&cfg.QueryStatsIntervalMs, "query-stats-interval-ms", cfg.QueryStatsIntervalMs, "Cadence for pg_stat_statements polling")
	flag.IntVar(&cfg.BatchMaxRows,         "batch-max-rows",          cfg.BatchMaxRows,         "Max rows per upload batch")
	flag.StringVar(&cfg.LogLevel, "log-level", cfg.LogLevel, "Log level: debug | info | warn | error")
	flag.Parse()

	cfg.LoadEnv()

	if err := cfg.Validate(); err != nil {
		fmt.Fprintf(os.Stderr, "pulsedb-agent: invalid config: %v\n", err)
		os.Exit(2)
	}

	db, err := sql.Open("postgres", cfg.PostgresDSN)
	if err != nil {
		log.Fatalf("pulsedb-agent: open postgres: %v", err)
	}
	defer db.Close()
	if err := db.Ping(); err != nil {
		log.Fatalf("pulsedb-agent: ping postgres: %v", err)
	}

	ctx, cancel := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer cancel()

	fwd := newSDKForwarder(cfg.APIKey, cfg.Endpoint)
	runner := agent.NewRunner(cfg, db, fwd)
	log.Printf("pulsedb-agent: started, wait_event=%v query_stats=%v",
		cfg.WaitEventInterval(), cfg.QueryStatsInterval())

	if err := runner.Run(ctx); err != nil && err != context.Canceled {
		log.Fatalf("pulsedb-agent: runner exit: %v", err)
	}
	log.Printf("pulsedb-agent: shutdown clean")
}
