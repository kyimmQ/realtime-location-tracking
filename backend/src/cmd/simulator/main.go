package main

import (
    "context"
    "flag"
    "log"
    "time"

    "delivery-tracking/internal/gpx"
    "delivery-tracking/internal/kafka"
    "delivery-tracking/internal/model"
)

func main() {
    gpxFile := flag.String("gpx-file", "route.gpx", "Path to GPX file")
    driverID := flag.String("driver-id", "D001", "Driver ID")
    tripID := flag.String("trip-id", "T001", "Trip ID")
    orderID := flag.String("order-id", "O001", "Order ID")
    brokers := flag.String("brokers", "localhost:9092", "Kafka brokers")
    interval := flag.Int("interval", 1000, "Milliseconds between points")
    flag.Parse()

    // Parse GPX
    points, err := gpx.Parse(*gpxFile)
    if err != nil {
        log.Fatalf("Parse GPX failed: %v", err)
    }
    log.Printf("Loaded %d points from %s", len(points), *gpxFile)

    // Create Kafka producer
    producer, err := kafka.NewProducer(*brokers)
    if err != nil {
        log.Fatalf("Create producer failed: %v", err)
    }
    defer producer.Close()

    // Publish each point
    ctx := context.Background()
    for i, pt := range points {
        event := model.LocationEvent{
            DriverID:  *driverID,
            TripID:    *tripID,
            OrderID:   *orderID,
            Latitude:  pt.Lat,
            Longitude: pt.Lon,
            Timestamp: pt.Time,
        }

        if err := producer.Publish(ctx, event); err != nil {
            log.Printf("Publish failed (point %d): %v", i, err)
            continue
        }

        log.Printf("[%d/%d] Published: %.6f, %.6f", i+1, len(points), pt.Lat, pt.Lon)

        // Wait before next point (simulate real-time)
        if i < len(points)-1 {
            time.Sleep(time.Duration(*interval) * time.Millisecond)
        }
    }

    log.Println("Playback complete")
}
