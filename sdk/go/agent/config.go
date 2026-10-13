// Package agent implements the FATHOM managed agent — a thin binary that
// runs on a host close to the monitored database, samples wait events
// and pg_stat_statements at a configurable cadence, and forwards the
// rollups via the existing SDK Transport.
//
// C1 (Wave C) scope:
//   - Config loading (YAML / env / flags).
//   - Postgres collector for pg_stat_activity (wait events) and
//     pg_stat_statements (top queries).
//   - Graceful shutdown on SIGINT/SIGTERM.
//
// Future scope (tracked separately):
//   - MySQL / MongoDB / host collectors.
//   - Auto-update channel + cosign verification.
//   - Privilege drop after pg_stat_statements read.
package agent

import (
	"errors"
	"fmt"
	"os"
	"strings"
	"time"
)

// Config is the in-memory representation of the agent's runtime config.
// Loaded from agent.yaml + ENV overrides + CLI flags, in that order.
type Config struct {
	// Identity
	ConnectionID string `yaml:"connection_id"`
	APIKey       string `yaml:"api_key"`
	Endpoint     string `yaml:"endpoint"`

	// Sampling
	WaitEventIntervalMs   int `yaml:"wait_event_interval_ms"`
	QueryStatsIntervalMs  int `yaml:"query_stats_interval_ms"`
	RollupIntervalMs      int `yaml:"rollup_interval_ms"`
	BatchMaxRows          int `yaml:"batch_max_rows"`

	// Postgres connection
	PostgresDSN string `yaml:"postgres_dsn"`

	// Operational
	LogLevel string `yaml:"log_level"`
}

// DefaultConfig returns a Config with sensible defaults for a single-host
// install. Most operators only need to set APIKey, Endpoint and PostgresDSN.
func DefaultConfig() Config {
	return Config{
		Endpoint:             "https://app.fathom.example.com",
		WaitEventIntervalMs:  1000,
		QueryStatsIntervalMs: 30000,
		RollupIntervalMs:     300000,
		BatchMaxRows:         500,
		LogLevel:             "info",
	}
}

// LoadEnv folds environment variables into c. ENV wins over the YAML
// defaults but is overridden in turn by CLI flags (handled in cmd).
func (c *Config) LoadEnv() {
	if v := os.Getenv("FATHOM_API_KEY");      v != "" { c.APIKey = v }
	if v := os.Getenv("FATHOM_ENDPOINT");     v != "" { c.Endpoint = v }
	if v := os.Getenv("FATHOM_CONNECTION_ID"); v != "" { c.ConnectionID = v }
	if v := os.Getenv("FATHOM_POSTGRES_DSN"); v != "" { c.PostgresDSN = v }
	if v := os.Getenv("FATHOM_LOG_LEVEL");    v != "" { c.LogLevel = strings.ToLower(v) }
}

// Validate returns nil if c is ready to start an agent run. Errors carry
// the missing field name so the binary can emit a clear startup message.
func (c *Config) Validate() error {
	var missing []string
	if c.APIKey == ""       { missing = append(missing, "api_key") }
	if c.Endpoint == ""     { missing = append(missing, "endpoint") }
	if c.PostgresDSN == ""  { missing = append(missing, "postgres_dsn") }
	if c.WaitEventIntervalMs < 100 {
		return fmt.Errorf("wait_event_interval_ms must be >= 100, got %d", c.WaitEventIntervalMs)
	}
	if c.QueryStatsIntervalMs < 1000 {
		return fmt.Errorf("query_stats_interval_ms must be >= 1000, got %d", c.QueryStatsIntervalMs)
	}
	if len(missing) > 0 {
		return fmt.Errorf("missing required config: %s", strings.Join(missing, ", "))
	}
	return nil
}

// WaitEventInterval is a convenience accessor that returns a time.Duration
// derived from WaitEventIntervalMs.
func (c Config) WaitEventInterval() time.Duration {
	return time.Duration(c.WaitEventIntervalMs) * time.Millisecond
}

// QueryStatsInterval returns the configured pg_stat_statements poll cadence.
func (c Config) QueryStatsInterval() time.Duration {
	return time.Duration(c.QueryStatsIntervalMs) * time.Millisecond
}

// RollupInterval returns the cadence at which the agent flushes rolled-up
// observations to the backend.
func (c Config) RollupInterval() time.Duration {
	return time.Duration(c.RollupIntervalMs) * time.Millisecond
}

// ErrConfigUnset is returned by Validate when a required field is empty.
var ErrConfigUnset = errors.New("config unset")
