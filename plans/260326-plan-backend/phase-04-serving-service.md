---
title: "Phase 4: Golang Serving Service"
description: "REST API (orders, trips, analytics, alerts, heatmap) + WebSocket hub (location + alerts)"
status: pending
priority: P1
effort: 4h
branch: main
tags: [backend, golang, gin, websocket]
created: 2026-03-26
---

# Phase 4: Serving Service (API + WebSocket)

## Context Links

- Parent: [plan.md](./plan.md)
- Depends on: [Phase 1](./phase-01-infrastructure.md), [Phase 3](./phase-03-kafka-streams.md)
- Spec: `SPECIFICATION.md` (API Server §5.8, WebSocket Protocol §5.8)

## Overview

| Field | Value |
|-------|-------|
| Priority | P1 |
| Status | Pending |
| Effort | 4h |

**Two responsibilities:**
1. **REST API**: Orders CRUD, trip route playback, driver analytics, alerts query, heatmap
2. **WebSocket**: Consume from `processed-updates` AND `alerts`, push to subscribed browsers

## Architecture

```
Browser (WebSocket) ←── Hub ←── Kafka Consumer (processed-updates)
Browser (WebSocket) ←── Hub ←── Kafka Consumer (alerts)
Browser (HTTP)      ←── Gin Router ←── Cassandra (all 5 tables)
```

## Full API Endpoints

| Method | Path | Description | Cassandra Table |
|--------|------|-------------|-----------------|
| POST | `/api/orders` | Create new delivery order | `orders` |
| GET | `/api/orders/:id` | Get order details | `orders` |
| PUT | `/api/orders/:id/status` | Update order status | `orders` |
| GET | `/api/trips/:id` | Get trip summary | `trip_metadata` |
| GET | `/api/trips/:id/route` | Get full GPS trace for playback | `trip_locations` |
| GET | `/api/drivers/:id/analytics` | Get weekly performance stats | `driver_analytics` |
| GET | `/api/drivers/:id/alerts` | Get safety violations | `alerts` |
| GET | `/api/admin/heatmap` | Get delivery density by zone | `trip_locations` |

## WebSocket Protocol

```bash
# Connect
ws://localhost:8080/ws/tracking

# Client → Server: subscribe to driver location
{"action": "subscribe", "driver_id": "D001"}

# Client → Server: subscribe to alerts
{"action": "subscribe_alerts"}

# Server → Client: location update (every second)
{
  "type": "location_update",
  "driver_id": "D001",
  "latitude": 10.772345,
  "longitude": 106.675123,
  "speed": 35.5,
  "eta_seconds": 480,
  "distance_km": 2.3,
  "is_speeding": false
}

# Server → Client: alert notification
{
  "type": "alert",
  "alert_type": "SPEEDING",
  "driver_id": "D001",
  "severity": "HIGH",
  "message": "Speed limit exceeded: 65 km/h in 60 km/h zone",
  "metadata": {"current_speed": "65", "limit": "60"}
}
```

## Project Structure

```
src/
├── cmd/api/
│   └── main.go
├── internal/
│   ├── api/
│   │   ├── router.go
│   │   └── handlers/
│   │       ├── orders.go       # Orders + status
│   │       ├── trips.go        # Trip summary + route playback
│   │       ├── drivers.go       # Analytics + alerts
│   │       └── admin.go         # Heatmap
│   ├── websocket/
│   │   ├── hub.go             # Hub: subscribe/unsubscribe/broadcast
│   │   ├── consumer.go        # Kafka consumer: processed-updates → hub
│   │   └── alertConsumer.go   # Kafka consumer: alerts → hub
│   └── cassandra/
│       ├── client.go           # Cassandra session
│       ├── orders.go           # orders table queries
│       ├── trips.go            # trip_locations + trip_metadata queries
│       ├── drivers.go          # driver_analytics + alerts queries
│       └── heatmap.go          # Geo-hash aggregation
├── go.mod
└── go.sum
```

## Key Components

### `internal/cassandra/trips.go` — Route Playback (Requirement 5)

```go
// Get full GPS trace for a trip, ordered ascending for playback
func (c *Client) GetTripRoute(tripID string) ([]TripPoint, error) {
    session := c.GetSession()
    query := `SELECT timestamp, latitude, longitude, speed, heading
              FROM trip_locations
              WHERE trip_id = ? ORDER BY timestamp ASC`
    rows := session.Query(query, tripID).Exec()

    var points []TripPoint
    for rows.Next() {
        var p TripPoint
        rows.Scan(&p.Timestamp, &p.Latitude, &p.Longitude, &p.Speed, &p.Heading)
        points = append(points, p)
    }
    return points, nil
}
```

### `internal/cassandra/drivers.go` — Analytics Query (Requirement 6)

```go
// Get weekly driver analytics
func (c *Client) GetDriverAnalytics(driverID string) ([]DriverWeekStats, error) {
    session := c.GetSession()
    query := `SELECT week_start_date, total_trips, total_distance,
                     average_speed, speeding_violations
              FROM driver_analytics
              WHERE driver_id = ? AND week_start_date >= ?
              ORDER BY week_start_date DESC`
    rows := session.Query(query, driverID, "2024-01-01").Exec()

    var stats []DriverWeekStats
    for rows.Next() {
        var s DriverWeekStats
        rows.Scan(&s.WeekStart, &s.TotalTrips, &s.TotalDistance,
                  &s.AverageSpeed, &s.SpeedingViolations)
        stats = append(stats, s)
    }
    return stats, nil
}

// Get recent alerts for a driver
func (c *Client) GetDriverAlerts(driverID string, since time.Time) ([]Alert, error) {
    session := c.GetSession()
    query := `SELECT alert_id, alert_type, severity, message, timestamp, metadata
              FROM alerts
              WHERE driver_id = ? AND timestamp >= ?
              ORDER BY timestamp DESC LIMIT 100`
    rows := session.Query(query, driverID, since).Exec()

    var alerts []Alert
    for rows.Next() {
        var a Alert
        rows.Scan(&a.ID, &a.Type, &a.Severity, &a.Message, &a.Timestamp, &a.Metadata)
        alerts = append(alerts, a)
    }
    return alerts, nil
}
```

### `internal/cassandra/heatmap.go` — Heatmap (Requirement 8)

```go
// Get delivery density by geo-hash cells
// Groups trip_locations by geohash prefix (precision 5 = ~5km cells)
func (c *Client) GetHeatmapData(since, until time.Time) ([]HeatmapCell, error) {
    session := c.GetSession()
    query := `SELECT blobAsText(geohash), count(*)
              FROM trip_locations
              WHERE timestamp >= ? AND timestamp < ?
              GROUP BY geohash(latitude, longitude, 5)`
    rows := session.Query(query, since, until).Exec()

    var cells []HeatmapCell
    for rows.Next() {
        var c HeatmapCell
        rows.Scan(&c.GeoHash, &c.DeliveryCount)
        cells = append(cells, c)
    }
    return cells, nil
}
```

### `internal/websocket/alertConsumer.go`

```go
// Separate Kafka consumer for alerts topic
// Broadcasts alerts to all subscribed clients (admin dashboard)

func (c *AlertConsumer) Consume(ctx context.Context) {
    for {
        msg, err := c.reader.ReadMessage(ctx)
        if err != nil {
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
```

### `cmd/api/main.go`

```go
func main() {
    kafkaBrokers := getEnv("KAFKA_BROKERS", "localhost:9092")
    cassandraHosts := getEnv("CASSANDRA_HOSTS", "localhost:9042")
    port := getEnv("PORT", "8080")

    // Cassandra
    cassandra, err := cassandra.NewClient(cassandraHosts)
    if err != nil {
        log.Fatalf("Cassandra connection failed: %v", err)
    }

    // WebSocket hub
    hub := websocket.NewHub()
    go hub.Run()

    // Kafka consumers (processed-updates + alerts)
    locationConsumer, err := kafka.NewConsumer(kafkaBrokers, "processed-updates", hub)
    alertConsumer, err := kafka.NewAlertConsumer(kafkaBrokers, hub)
    go locationConsumer.Consume(context.Background())
    go alertConsumer.Consume(context.Background())

    // REST API
    router := api.SetupRouter(hub, cassandra)
    srv := &http.Server{Addr: ":" + port, Handler: router}
    go srv.ListenAndServe()

    log.Printf("Server on :%s", port)
    quit := make(chan os.Signal, 1)
    signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
    <-quit

    ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
    defer cancel()
    srv.Shutdown(ctx)
}
```

## Todo List

- [ ] go.mod + dependencies
- [ ] Cassandra client (connect, query each table)
- [ ] WebSocket hub + 2 Kafka consumers (processed-updates, alerts)
- [ ] Orders handlers (create, get, status update)
- [ ] Trips handler (summary + route playback)
- [ ] Drivers handler (analytics + alerts)
- [ ] Admin handler (heatmap)
- [ ] Test: curl endpoints + browser WS client

## Success Criteria

- `go build ./cmd/api` compiles
- `curl http://localhost:8080/api/orders/O001` returns order JSON
- `curl http://localhost:8080/api/trips/T001/route` returns GPS points for playback
- `curl http://localhost:8080/api/drivers/D001/analytics` returns weekly stats
- `curl http://localhost:8080/api/drivers/D001/alerts` returns alert history
- `curl http://localhost:8080/api/admin/heatmap` returns geo-hash density data
- WebSocket connects and receives both location updates and alert notifications
- No crashes or panics
