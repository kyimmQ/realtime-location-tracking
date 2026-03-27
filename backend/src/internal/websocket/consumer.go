package websocket

import (
	"context"
	"encoding/json"
	"log"

	"github.com/segmentio/kafka-go"
)

type LocationConsumer struct {
	reader *kafka.Reader
	hub    *Hub
}

func NewConsumer(brokers, topic string, hub *Hub) (*LocationConsumer, error) {
	reader := kafka.NewReader(kafka.ReaderConfig{
		Brokers: []string{brokers},
		Topic:   topic,
		GroupID: "serving-service-location-group",
	})
	return &LocationConsumer{
		reader: reader,
		hub:    hub,
	}, nil
}

func (c *LocationConsumer) Consume(ctx context.Context) {
	for {
		msg, err := c.reader.ReadMessage(ctx)
		if err != nil {
			if ctx.Err() != nil {
				log.Println("Location consumer shutting down...")
				return
			}
			log.Printf("Location read error: %v", err)
			continue
		}

		var update map[string]interface{}
		if err := json.Unmarshal(msg.Value, &update); err != nil {
			log.Printf("Location unmarshal error: %v", err)
			continue
		}

		driverID, ok := update["driver_id"].(string)
		if !ok {
			log.Printf("Location update missing driver_id")
			continue
		}

		wrapped := map[string]interface{}{
			"type": "location_update",
			"payload": update,
		}

		c.hub.BroadcastLocation(driverID, wrapped)
	}
}

func (c *LocationConsumer) Close() error {
	return c.reader.Close()
}
