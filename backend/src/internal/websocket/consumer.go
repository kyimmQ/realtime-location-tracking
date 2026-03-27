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

		// Flatten nested location object and rename distance_to_destination to distance_km
		// Backend sends: { location: { latitude, longitude }, distance_to_destination, ... }
		// Frontend expects: { latitude, longitude, distance_km, ... }
		payload := map[string]interface{}{
			"driver_id":   driverID,
			"trip_id":     update["trip_id"],
			"speed":       update["speed"],
			"eta_seconds":  update["eta_seconds"],
			"distance_km": update["distance_to_destination"],
		}

		// Extract nested location
		if loc, ok := update["location"].(map[string]interface{}); ok {
			payload["latitude"] = loc["latitude"]
			payload["longitude"] = loc["longitude"]
		}

		wrapped := map[string]interface{}{
			"type":    "location_update",
			"payload": payload,
		}

		c.hub.BroadcastLocation(driverID, wrapped)
	}
}

func (c *LocationConsumer) Close() error {
	return c.reader.Close()
}
