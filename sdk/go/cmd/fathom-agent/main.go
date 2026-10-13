// Command fathom-agent is the FATHOM managed agent binary.
//
//   $ fathom-agent --config /etc/fathom/agent.yaml
//   $ fathom-agent --postgres-dsn postgres://... --api-key sk_live_... --endpoint https://app.fathom.dev
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

	"github.com/fathom/fathom-go/agent"
	_ "github.com/lib/pq"
)

func main() {
	cfg := agent.DefaultConfig()

	flag.StringVar(&cfg.APIKey,       "api-key",       cfg.APIKey,       "FATHOM API key (or FATHOM_API_KEY)")
	flag.StringVar(&cfg.Endpoint,     "endpoint",      cfg.Endpoint,     "FATHOM endpoint (or FATHOM_ENDPOINT)")
	flag.StringVar(&cfg.ConnectionID, "connection-id", cfg.ConnectionID, "FATHOM connection ID this agent represents")
	flag.StringVar(&cfg.PostgresDSN,  "postgres-dsn",  cfg.PostgresDSN,  "Postgres DSN to monitor (or FATHOM_POSTGRES_DSN)")
	flag.IntVar(&cfg.WaitEventIntervalMs,  "wait-event-interval-ms",  cfg.WaitEventIntervalMs,  "Cadence for pg_stat_activity polling")
	flag.IntVar(&cfg.QueryStatsIntervalMs, "query-stats-interval-ms", cfg.QueryStatsIntervalMs, "Cadence for pg_stat_statements polling")
	flag.IntVar(&cfg.BatchMaxRows,         "batch-max-rows",          cfg.BatchMaxRows,         "Max rows per upload batch")
	flag.StringVar(&cfg.LogLevel, "log-level", cfg.LogLevel, "Log level: debug | info | warn | error")
	flag.Parse()

	cfg.LoadEnv()

	if err := cfg.Validate(); err != nil {
		fmt.Fprintf(os.Stderr, "fathom-agent: invalid config: %v\n", err)
		os.Exit(2)
	}

	db, err := sql.Open("postgres", cfg.PostgresDSN)
	if err != nil {
		log.Fatalf("fathom-agent: open postgres: %v", err)
	}
	defer db.Close()
	if err := db.Ping(); err != nil {
		log.Fatalf("fathom-agent: ping postgres: %v", err)
	}

	ctx, cancel := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer cancel()

	fwd := newSDKForwarder(cfg.APIKey, cfg.Endpoint)
	runner := agent.NewRunner(cfg, db, fwd)
	log.Printf("fathom-agent: started, wait_event=%v query_stats=%v",
		cfg.WaitEventInterval(), cfg.QueryStatsInterval())

	if err := runner.Run(ctx); err != nil && err != context.Canceled {
		log.Fatalf("fathom-agent: runner exit: %v", err)
	}
	log.Printf("fathom-agent: shutdown clean")
}
