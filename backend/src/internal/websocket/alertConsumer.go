package websocket

import (
	"context"
	"encoding/json"
	"log"

	"github.com/segmentio/kafka-go"
)

type AlertConsumer struct {
	reader *kafka.Reader
	hub    *Hub
}

func NewAlertConsumer(brokers string, hub *Hub) (*AlertConsumer, error) {
	reader := kafka.NewReader(kafka.ReaderConfig{
		Brokers: []string{brokers},
		Topic:   "alerts",
		GroupID: "serving-service-alert-group",
	})
	return &AlertConsumer{
		reader: reader,
		hub:    hub,
	}, nil
}

func (c *AlertConsumer) Consume(ctx context.Context) {
	for {
		msg, err := c.reader.ReadMessage(ctx)
		if err != nil {
			if ctx.Err() != nil {
				log.Println("Alert consumer shutting down...")
				return
			}
			log.Printf("Alert read error: %v", err)
			continue
		}

		var alert map[string]interface{}
		if err := json.Unmarshal(msg.Value, &alert); err != nil {
			log.Printf("Alert unmarshal error: %v", err)
			continue
		}

		wrapped := map[string]interface{}{
			"type":    "alert",
			"payload": alert,
		}
		c.hub.BroadcastAlert(wrapped)
	}
}

func (c *AlertConsumer) Close() error {
	return c.reader.Close()
}
