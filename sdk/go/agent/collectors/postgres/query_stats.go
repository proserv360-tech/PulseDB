package postgres

import (
	"context"
	"database/sql"
	"time"
)

// QueryStat is one row from pg_stat_statements (or the closest available
// view if the extension isn't installed). The agent rolls these up into
// "top queries by load" before forwarding.
type QueryStat struct {
	SampledAt   time.Time `json:"sampled_at"`
	QueryID     int64     `json:"query_id"`
	UserName    *string   `json:"user_name,omitempty"`
	DBName      *string   `json:"db_name,omitempty"`
	Calls       int64     `json:"calls"`
	TotalMs     float64   `json:"total_ms"`
	MeanMs      float64   `json:"mean_ms"`
	Rows        int64     `json:"rows"`
	// Body left empty when pg_stat_statements_normalized is used so we
	// never forward unredacted literals.
	Query       string    `json:"query,omitempty"`
}

// QueryStatsCollector reads pg_stat_statements. If the extension is not
// installed, Sample returns an empty slice with a nil error so the agent
// can degrade gracefully — the operator sees "no top-query data" in the
// UI rather than an alert spam.
type QueryStatsCollector struct {
	DB              *sql.DB
	IncludeStatement bool // forwarded as the Query field when true; default false
}

// NewQueryStatsCollector binds the collector to a *sql.DB.
func NewQueryStatsCollector(db *sql.DB) *QueryStatsCollector {
	return &QueryStatsCollector{DB: db}
}

const queryStatsSQL = `
SELECT queryid, usename, datname, calls, total_exec_time, mean_exec_time, rows, query
  FROM pg_stat_statements
  JOIN pg_user ON pg_stat_statements.userid = pg_user.usesysid
  JOIN pg_database ON pg_stat_statements.dbid = pg_database.oid
 ORDER BY total_exec_time DESC
 LIMIT 200
`

// Sample collects the current top-200 by total execution time. The
// caller is responsible for diffing against the previous snapshot to
// get per-interval load.
func (c *QueryStatsCollector) Sample(ctx context.Context) ([]QueryStat, error) {
	rows, err := c.DB.QueryContext(ctx, queryStatsSQL)
	if err != nil {
		// pg_stat_statements may not be installed. The backend lists the
		// 'queryHistory' capability as false in that case; agents should
		// not fail-loud.
		if isUndefinedRelation(err) || isUndefinedFunction(err) {
			return []QueryStat{}, nil
		}
		return nil, err
	}
	defer rows.Close()

	now := time.Now().UTC()
	out := make([]QueryStat, 0, 200)
	for rows.Next() {
		var s QueryStat
		var query sql.NullString
		s.SampledAt = now
		if err := rows.Scan(
			&s.QueryID, &s.UserName, &s.DBName,
			&s.Calls, &s.TotalMs, &s.MeanMs, &s.Rows, &query,
		); err != nil {
			return out, err
		}
		if c.IncludeStatement && query.Valid {
			s.Query = query.String
		}
		out = append(out, s)
	}
	return out, rows.Err()
}

// isUndefinedRelation matches the PG SQLSTATE 42P01 (relation does not
// exist). We use string matching rather than the pgx-typed error because
// the agent uses database/sql + pq, which doesn't surface SQLSTATEs as a
// dedicated type.
func isUndefinedRelation(err error) bool {
	if err == nil {
		return false
	}
	msg := err.Error()
	for _, marker := range []string{
		"does not exist",
		"42P01",
	} {
		if contains(msg, marker) {
			return true
		}
	}
	return false
}

func isUndefinedFunction(err error) bool {
	if err == nil {
		return false
	}
	return contains(err.Error(), "42883")
}

func contains(haystack, needle string) bool {
	return len(haystack) >= len(needle) && (haystack == needle || index(haystack, needle) >= 0)
}

func index(s, sub string) int {
	for i := 0; i+len(sub) <= len(s); i++ {
		if s[i:i+len(sub)] == sub {
			return i
		}
	}
	return -1
}
