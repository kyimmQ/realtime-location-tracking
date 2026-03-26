---
title: "Phase 2: Golang Ingestion Service"
description: "GPX parser extracts lat/lon, pushes to Kafka raw-location-events"
status: pending
priority: P1
effort: 3h
branch: main
tags: [backend, golang, kafka, ingestion]
created: 2026-03-26
---

# Phase 2: Ingestion Service (GPX → Kafka)

## Context Links

- Parent: [plan.md](./plan.md)
- Depends on: [Phase 1](./phase-01-infrastructure.md)
- Spec: `SPECIFICATION.md` (GPX → Kafka flow)

## Overview

| Field | Value |
|-------|-------|
| Priority | P1 |
| Status | Pending |
| Effort | 3h |

**PoC Simplification:**
- Single GPX file, single trip
- Only extract **lat** and **lon** from each `<trkpt>` (ignore speed, heading from GPX)
- Push to `raw-location-events` topic at 1 point/second

## Data Flow

```
GPX file → Parse lat/lon → JSON → Kafka (raw-location-events)
```

## Message Schema

```json
{
  "driver_id": "D001",
  "trip_id": "T001",
  "order_id": "O001",
  "latitude": 10.762622,
  "longitude": 106.660172,
  "timestamp": "2024-01-30T10:15:32Z"
}
```

## Project Structure

```
src/
├── cmd/simulator/
│   └── main.go           # CLI: go run cmd/simulator/main.go --gpx-file=route.gpx
├── internal/
│   ├── gpx/
│   │   └── parser.go    # Parse GPX XML, extract lat/lon
│   ├── kafka/
│   │   └── producer.go   # segmentio/kafka-go producer
│   └── model/
│       └── location.go   # LocationEvent struct
├── go.mod
└── go.sum
```

## Implementation Details

### `internal/gpx/parser.go`

```go
package gpx

import (
    "encoding/xml"
    "os"
    "time"
)

// TrackPoint represents a single GPS point from GPX
type TrackPoint struct {
    Lat  float64   `xml:"lat,attr"`
    Lon  float64   `xml:"lon,attr"`
    Time time.Time `xml:"time"`
}

// Parse reads a GPX file and returns all trackpoints
func Parse(path string) ([]TrackPoint, error) {
    data, err := os.ReadFile(path)
    if err != nil {
        return nil, err
    }

    var gpx struct {
        Tracks []struct {
            Segs []struct {
                Points []TrackPoint `xml:"trkpt"`
            } `xml:"trkseg"`
        } `xml:"trk"`
    }

    if err := xml.Unmarshal(data, &gpx); err != nil {
        return nil, err
    }

    var all []TrackPoint
    for _, trk := range gpx.Tracks {
        for _, seg := range trk.Segs {
            all = append(all, seg.Points...)
        }
    }
    return all, nil
}
```

### `internal/model/location.go`

```go
package model

import "time"

type LocationEvent struct {
    DriverID  string    `json:"driver_id"`
    TripID    string    `json:"trip_id"`
    OrderID   string    `json:"order_id"`
    Latitude  float64   `json:"latitude"`
    Longitude float64   `json:"longitude"`
    Timestamp time.Time  `json:"timestamp"`
}
```

### `internal/kafka/producer.go`

```go
package kafka

import (
    "context"
    "encoding/json"
    "time"

    "github.com/segmentio/kafka-go"
)

type Producer struct {
    writer *kafka.Writer
}

func NewProducer(brokers string) (*Producer, error) {
    writer := &kafka.Writer{
        Addr:         kafka.TCP(brokers),
        Topic:        "raw-location-events",
        Balancer:     &kafka.LeastBytes{},
        BatchTimeout: 10 * time.Millisecond,
    }
    return &Producer{writer: writer}, nil
}

func (p *Producer) Publish(ctx context.Context, event interface{}) error {
    data, err := json.Marshal(event)
    if err != nil {
        return err
    }
    return p.writer.WriteMessages(ctx, kafka.Message{Value: data})
}

func (p *Producer) Close() error {
    return p.writer.Close()
}
```

### `cmd/simulator/main.go`

```go
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
```

## CLI Usage

```bash
# Terminal 1: Start services
docker-compose up -d

# Terminal 2: Run simulator
go run cmd/simulator/main.go \
  --gpx-file=../gpxs/sample.gpx \
  --driver-id=D001 \
  --trip-id=T001 \
  --order-id=O001 \
  --interval=1000

# Verify with kafka console consumer
docker exec kafka kafka-console-consumer --topic raw-location-events --from-beginning
```

## Todo List

- [ ] Create go.mod
- [ ] Implement model.LocationEvent
- [ ] Implement gpx.Parse
- [ ] Implement kafka.Producer
- [ ] Implement main CLI
- [ ] Test with sample GPX

## Success Criteria

- `go build ./cmd/simulator` compiles
- Running simulator publishes JSON to `raw-location-events`
- `kafka-console-consumer` shows messages with lat/lon

## Unresolved Questions

1. **GPX timestamp**: Trust `<time>` tag or generate current time? (Use GPX time if present)
