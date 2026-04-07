package postgres

import (
	"context"
	"fmt"
	"os"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Client wraps a pgxpool connection pool.
type Client struct {
	pool *pgxpool.Pool
}

var client *Client

// Connect establishes a connection pool to PostgreSQL. Environment variables:
// POSTGRES_HOST, POSTGRES_PORT, POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB.
func Connect(ctx context.Context) (*Client, error) {
	host := os.Getenv("POSTGRES_HOST")
	if host == "" {
		host = "localhost"
	}
	port := os.Getenv("POSTGRES_PORT")
	if port == "" {
		port = "5432"
	}
	user := os.Getenv("POSTGRES_USER")
	if user == "" {
		user = "postgres"
	}
	password := os.Getenv("POSTGRES_PASSWORD")
	if password == "" {
		password = "postgres"
	}
	dbname := os.Getenv("POSTGRES_DB")
	if dbname == "" {
		dbname = "delivery_tracking"
	}

	connStr := fmt.Sprintf("postgres://%s:%s@%s:%s/%s?sslmode=disable",
		user, password, host, port, dbname)

	poolConfig, err := pgxpool.ParseConfig(connStr)
	if err != nil {
		return nil, fmt.Errorf("parse config: %w", err)
	}

	pool, err := pgxpool.NewWithConfig(ctx, poolConfig)
	if err != nil {
		return nil, fmt.Errorf("create pool: %w", err)
	}

	if err := pool.Ping(ctx); err != nil {
		return nil, fmt.Errorf("ping: %w", err)
	}

	client = &Client{pool: pool}
	return client, nil
}

// Get returns the singleton Client. Returns nil if Connect was never called.
func Get() *Client {
	return client
}

// Pool returns the underlying pgxpool.Pool for callers that need typed row scanning.
func (c *Client) Pool() *pgxpool.Pool {
	return c.pool
}

// Query executes a SELECT and returns all rows as slices of interface{}.
func (c *Client) Query(ctx context.Context, sql string, args ...interface{}) ([][]interface{}, error) {
	rows, err := c.pool.Query(ctx, sql, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results [][]interface{}
	for rows.Next() {
		values, err := rows.Values()
		if err != nil {
			return nil, err
		}
		results = append(results, values)
	}
	return results, rows.Err()
}

// QueryRowScan executes a query and returns the raw pgx.Row for custom Scan operations.
// Use this for INSERT ... RETURNING statements.
func (c *Client) QueryRowScan(ctx context.Context, sql string, args ...interface{}) (interface{ Scan(dest ...interface{}) error }, error) {
	return c.pool.QueryRow(ctx, sql, args...), nil
}

// InsertRow executes an INSERT ... RETURNING query and scans the result into dest.
func (c *Client) InsertRow(ctx context.Context, sql string, args ...interface{}) error {
	return c.pool.QueryRow(ctx, sql, args...).Scan(args...)
}

// QueryRow executes a SELECT and returns the first row, or nil if no rows.
func (c *Client) QueryRow(ctx context.Context, sql string, args ...interface{}) ([]interface{}, error) {
	rows, err := c.Query(ctx, sql, args...)
	if err != nil {
		return nil, err
	}
	if len(rows) == 0 {
		return nil, nil
	}
	return rows[0], nil
}

// Exec executes a statement that does not return rows (INSERT, UPDATE, DELETE).
func (c *Client) Exec(ctx context.Context, sql string, args ...interface{}) error {
	_, err := c.pool.Exec(ctx, sql, args...)
	return err
}

// Close releases all connections in the pool.
func (c *Client) Close() {
	if client != nil {
		client.pool.Close()
	}
}
