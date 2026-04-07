package postgres

import (
	"context"
)

// PGClient defines the interface for PostgreSQL operations used by handlers.
// This allows for mock implementations in tests.
type PGClient interface {
	Query(ctx context.Context, sql string, args ...interface{}) ([][]interface{}, error)
	QueryRow(ctx context.Context, sql string, args ...interface{}) ([]interface{}, error)
	Exec(ctx context.Context, sql string, args ...interface{}) error
}

// Compile-time check that *Client implements PGClient
var _ PGClient = (*Client)(nil)
