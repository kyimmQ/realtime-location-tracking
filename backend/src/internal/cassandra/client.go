package cassandra

import (
	"log"
	"strings"
	"time"

	"github.com/gocql/gocql"
)

type Client struct {
	session *gocql.Session
}

func NewClient(hosts string) (*Client, error) {
	cluster := gocql.NewCluster(strings.Split(hosts, ",")...)
	cluster.Keyspace = "delivery_tracking"
	cluster.Consistency = gocql.Quorum
	cluster.Timeout = 5 * time.Second

	session, err := cluster.CreateSession()
	if err != nil {
		log.Printf("Failed to connect to Cassandra: %v", err)
		return nil, err
	}

	log.Println("Connected to Cassandra")
	return &Client{session: session}, nil
}

func (c *Client) GetSession() *gocql.Session {
	return c.session
}

func (c *Client) Close() {
	if c.session != nil {
		c.session.Close()
	}
}
