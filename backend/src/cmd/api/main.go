package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"delivery-tracking/internal/api"
	"delivery-tracking/internal/cassandra"
	"delivery-tracking/internal/websocket"
)

func getEnv(key, fallback string) string {
	if value, exists := os.LookupEnv(key); exists {
		return value
	}
	return fallback
}

func main() {
	kafkaBrokers := getEnv("KAFKA_BROKERS", "localhost:9092")
	cassandraHosts := getEnv("CASSANDRA_HOSTS", "localhost:9042")
	port := getEnv("PORT", "8080")

	// Cassandra
	cassandraClient, err := cassandra.NewClient(cassandraHosts)
	if err != nil {
		log.Fatalf("Cassandra connection failed: %v", err)
	}
	defer cassandraClient.Close()

	// WebSocket hub
	hub := websocket.NewHub()
	go hub.Run()

	// Kafka consumers (processed-updates + alerts)
	locationConsumer, err := websocket.NewConsumer(kafkaBrokers, "processed-updates", hub)
	if err != nil {
		log.Fatalf("Location consumer failed: %v", err)
	}
	alertConsumer, err := websocket.NewAlertConsumer(kafkaBrokers, hub)
	if err != nil {
		log.Fatalf("Alert consumer failed: %v", err)
	}

	consumerCtx, consumerCancel := context.WithCancel(context.Background())
	go locationConsumer.Consume(consumerCtx)
	go alertConsumer.Consume(consumerCtx)

	// REST API
	router := api.SetupRouter(hub, cassandraClient)
	srv := &http.Server{Addr: ":" + port, Handler: router}
	go func() {
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("listen: %s\n", err)
		}
	}()

	log.Printf("Server running on :%s", port)
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println("Shutting down server...")

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	consumerCancel()

	if err := locationConsumer.Close(); err != nil {
		log.Printf("Error closing location consumer: %v", err)
	}
	if err := alertConsumer.Close(); err != nil {
		log.Printf("Error closing alert consumer: %v", err)
	}

	if err := srv.Shutdown(ctx); err != nil {
		log.Fatal("Server forced to shutdown:", err)
	}

	log.Println("Server exiting")
}
