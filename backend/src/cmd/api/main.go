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
	"delivery-tracking/internal/gpx"
	"delivery-tracking/internal/kafka"
	"delivery-tracking/internal/postgres"
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

	// PostgreSQL (auth, users, orders)
	pgCtx := context.Background()
	pgClient, err := postgres.Connect(pgCtx)
	if err != nil {
		log.Fatalf("PostgreSQL connection failed: %v", err)
	}
	defer pgClient.Close()
	log.Println("PostgreSQL connected")

	// Cassandra (time-series data)
	cassandraClient, err := cassandra.NewClient(cassandraHosts)
	if err != nil {
		log.Fatalf("Cassandra connection failed: %v", err)
	}
	defer cassandraClient.Close()

	// GPX service
	gpxService := gpx.NewService(getEnv("GPX_DIR", "gpxs"))

	// Kafka producer (for simulator)
	kafkaProducer, err := kafka.NewProducer(kafkaBrokers)
	if err != nil {
		log.Fatalf("Kafka producer failed: %v", err)
	}
	defer kafkaProducer.Close()

	// WebSocket hub
	hub := websocket.NewHub()
	go hub.Run()

	// Kafka consumers (processed-updates + alerts)
	locationConsumer, err := websocket.NewConsumer(kafkaBrokers, "processed-updates", hub, cassandraClient)
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

	// REST API (passes gpxService and kafkaProducer for simulator)
	router := api.SetupRouter(hub, cassandraClient, pgClient, kafkaProducer, gpxService)
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
