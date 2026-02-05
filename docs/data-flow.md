# Data Flow Documentation

**Version:** 2.0.0
**Last Updated:** 2026-01-30

## 1. Overview

This document details the complete data flow through the real-time delivery tracking system, from GPS data ingestion to visualization in the customer UI.

## 2. End-to-End Data Flow Diagram

```mermaid
flowchart TD
    subgraph "Data Sources"
        GPX[GPX File<br/>Route Coordinates]
    end

    subgraph "Ingestion Layer (Golang)"
        Parser[GPX Parser]
        Validator[Data Validator]
        Producer[Kafka Producer<br/>segmentio/kafka-go]
    end

    subgraph "Messaging Layer (Apache Kafka)"
        RawTopic[Topic: raw-location-events<br/>Partitions: 3<br/>Retention: 24h]
        ProcessedTopic[Topic: processed-updates<br/>Partitions: 3<br/>Retention: 7d]
        AlertsTopic[Topic: alerts<br/>Partitions: 1<br/>Retention: 30d]
    end

    subgraph "Stream Processing (Java Kafka Streams)"
        FilterNode[Filter<br/>Invalid Coordinates]
        StateStore[(RocksDB<br/>State Store)]
        SpeedCalc[Calculate Speed<br/>Stateful Processor]
        WindowAgg[Windowed Aggregation<br/>30s Tumbling Window]
        JoinNode[Stream-Table Join<br/>Destination Lookup]
        BranchNode{Branch Logic}
    end

    subgraph "Storage Layer (Cassandra)"
        OrdersTable[(orders)]
        TripLocTable[(trip_locations)]
        TripMetaTable[(trip_metadata)]
        AnalyticsTable[(driver_analytics)]
        AlertsTable[(alerts)]
    end

    subgraph "Application Layer (Golang)"
        RestAPI[REST API<br/>Gin Framework]
        WSHub[WebSocket Hub<br/>Gorilla WebSocket]
        Consumer[Kafka Consumer]
        CassandraDAO[Cassandra DAO<br/>gocql]
    end

    subgraph "Presentation Layer (React)"
        CustomerUI[Customer UI<br/>Leaflet Map]
        DriverUI[Driver UI]
        AdminUI[Admin Dashboard]
    end

    %% Flow connections
    GPX --> Parser
    Parser --> Validator
    Validator --> Producer
    Producer -->|Partition by driver_id| RawTopic

    RawTopic --> FilterNode
    FilterNode --> SpeedCalc
    SpeedCalc <-->|Read/Write| StateStore
    SpeedCalc --> WindowAgg
    WindowAgg --> JoinNode
    JoinNode --> BranchNode

    BranchNode -->|Valid Location| ProcessedTopic
    BranchNode -->|Speed > 60 km/h| AlertsTopic
    BranchNode -->|Distance < 500m| AlertsTopic

    ProcessedTopic --> Consumer
    ProcessedTopic --> CassandraDAO
    AlertsTopic --> Consumer

    Consumer --> WSHub
    WSHub -->|Real-time Push| CustomerUI
    WSHub -->|Real-time Push| DriverUI

    CassandraDAO --> TripLocTable
    RestAPI <--> OrdersTable
    RestAPI <--> TripMetaTable
    RestAPI <--> AnalyticsTable
    RestAPI <--> AlertsTable

    CustomerUI --> RestAPI
    DriverUI --> RestAPI
    AdminUI --> RestAPI

    style FilterNode fill:#90EE90
    style SpeedCalc fill:#FFB6C1
    style WindowAgg fill:#FFD700
    style JoinNode fill:#87CEEB
    style BranchNode fill:#FFA500
```

## 3. Detailed Flow: Customer Places Order

### 3.1. Data Flow Steps

```mermaid
sequenceDiagram
    actor Customer
    participant UI as React UI
    participant API as REST API (Go)
    participant DB as Cassandra

    Customer->>UI: Click "Place Order"
    UI->>API: POST /api/orders
    Note over API: Generate UUIDs:<br/>order_id, assign driver_id

    API->>DB: INSERT INTO orders
    Note over DB: Partition Key: order_id<br/>Values: customer_id, driver_id,<br/>restaurant_location,<br/>delivery_location, status='PENDING'

    DB-->>API: Success
    API-->>UI: { order_id, driver_id, status }
    UI-->>Customer: Show "Order Placed"<br/>Display assigned driver
```

### 3.2. Data Structure

**Request (POST /api/orders):**
```json
{
  "customer_id": "C456",
  "restaurant_location": "10.762622,106.660172",
  "delivery_location": "10.782345,106.695123"
}
```

**Cassandra Insert:**
```sql
INSERT INTO orders (
  order_id, customer_id, driver_id,
  restaurant_location, delivery_location,
  status, created_at
) VALUES (
  uuid(), 'C456', 'D123',
  '10.762622,106.660172', '10.782345,106.695123',
  'PENDING', toTimestamp(now())
);
```

## 4. Detailed Flow: GPS Data Ingestion

### 4.1. Data Flow Steps

```mermaid
sequenceDiagram
    participant GPX as GPX File
    participant Sim as Golang Simulator
    participant Kafka as Kafka Broker
    participant Streams as Kafka Streams

    GPX->>Sim: Read <trkpt> element
    Sim->>Sim: Parse lat, lng, timestamp
    Sim->>Sim: Validate coordinates
    Note over Sim: Check:<br/>lat: -90 to 90<br/>lng: -180 to 180<br/>accuracy < 20m

    Sim->>Kafka: Publish to raw-location-events
    Note over Kafka: Partition: hash(driver_id) mod 3<br/>Key: driver_id<br/>Value: JSON payload

    Kafka->>Streams: Consume from partition
    Streams->>Streams: Deserialize JSON
    Note over Streams: Apply Filter Topology
```

### 4.2. Data Structure

**GPX Input:**
```xml
<trkpt lat="10.762622" lon="106.660172">
  <time>2024-01-30T10:15:32Z</time>
  <speed>45.5</speed>
  <course>90</course>
</trkpt>
```

**Kafka Message (raw-location-events):**
```json
{
  "driver_id": "D123",
  "trip_id": "T456",
  "order_id": "O789",
  "timestamp": "2024-01-30T10:15:32.123Z",
  "latitude": 10.762622,
  "longitude": 106.660172,
  "speed": 45.5,
  "heading": 90,
  "altitude": 15.2,
  "accuracy": 5.0
}
```

## 5. Detailed Flow: Stream Processing

### 5.1. Kafka Streams Topology

```mermaid
flowchart TD
    Start([Consume from<br/>raw-location-events])

    Filter{Valid<br/>Coordinates?}
    Dup{Duplicate?}

    StateRead[(Read Previous<br/>Location from<br/>State Store)]
    SpeedCalc[Calculate Speed<br/>velocity = distance/time]
    StateWrite[(Write Current<br/>to State Store)]

    Window[Tumbling Window<br/>30 seconds]
    AvgSpeed[Calculate<br/>Average Speed]

    DestLookup[(KTable Lookup<br/>Destination<br/>Coordinates)]
    CalcDist[Calculate Distance<br/>haversine formula]
    CalcETA[Calculate ETA<br/>distance / avg_speed]

    SpeedCheck{Speed ><br/>60 km/h?}
    ProximityCheck{Distance <<br/>500m?}

    AlertTopic([Publish to<br/>alerts topic])
    ProcessedTopic([Publish to<br/>processed-updates])
    Cassandra[(Write to<br/>trip_locations)]

    Start --> Filter
    Filter -->|Invalid| Drop[Drop Event]
    Filter -->|Valid| Dup
    Dup -->|Yes| Drop
    Dup -->|No| StateRead

    StateRead --> SpeedCalc
    SpeedCalc --> StateWrite
    StateWrite --> Window

    Window --> AvgSpeed
    AvgSpeed --> DestLookup
    DestLookup --> CalcDist
    CalcDist --> CalcETA

    CalcETA --> SpeedCheck
    SpeedCheck -->|Yes| AlertTopic
    SpeedCheck -->|No| ProximityCheck

    ProximityCheck -->|Yes| AlertTopic
    ProximityCheck -->|No| ProcessedTopic

    CalcETA --> ProcessedTopic
    ProcessedTopic --> Cassandra

    style Filter fill:#90EE90
    style SpeedCalc fill:#FFB6C1
    style AvgSpeed fill:#FFD700
    style CalcETA fill:#87CEEB
```

### 5.2. Processing Logic Details

#### Filter Invalid Coordinates
```java
stream.filter((key, value) -> {
    double lat = value.getLatitude();
    double lng = value.getLongitude();
    double accuracy = value.getAccuracy();

    return lat >= -90 && lat <= 90 &&
           lng >= -180 && lng <= 180 &&
           accuracy <= 20.0;
});
```

#### Calculate Speed (Stateful)
```java
stream.transformValues(() -> new ValueTransformerWithKey<String, Location, EnrichedLocation>() {
    private KeyValueStore<String, Location> stateStore;

    @Override
    public void init(ProcessorContext context) {
        stateStore = context.getStateStore("previous-location-store");
    }

    @Override
    public EnrichedLocation transform(String driverId, Location current) {
        Location previous = stateStore.get(driverId);

        if (previous == null) {
            stateStore.put(driverId, current);
            return new EnrichedLocation(current, 0.0);
        }

        double distance = haversine(previous, current);  // km
        long timeDelta = current.timestamp - previous.timestamp;  // ms
        double speed = (distance / (timeDelta / 1000.0)) * 3600;  // km/h

        stateStore.put(driverId, current);
        return new EnrichedLocation(current, speed);
    }
}, "previous-location-store");
```

#### Windowed Aggregation for Average Speed
```java
stream
    .groupByKey()
    .windowedBy(TimeWindows.ofSizeWithNoGrace(Duration.ofSeconds(30)))
    .aggregate(
        SpeedAccumulator::new,
        (key, value, aggregate) -> aggregate.add(value.getSpeed()),
        Materialized.<String, SpeedAccumulator, WindowStore<Bytes, byte[]>>as("speed-window-store")
            .withKeySerde(Serdes.String())
            .withValueSerde(speedAccumulatorSerde)
    )
    .toStream()
    .mapValues(SpeedAccumulator::average);
```

#### Stream-Table Join for Proximity
```java
KTable<String, Destination> destinationTable = builder.table(
    "destinations",
    Consumed.with(Serdes.String(), destinationSerde)
);

enrichedStream
    .join(destinationTable,
        (location, destination) -> {
            double distance = haversine(
                location.getLatitude(), location.getLongitude(),
                destination.getLatitude(), destination.getLongitude()
            );
            return new ProximityResult(location, destination, distance);
        },
        Joined.with(Serdes.String(), locationSerde, destinationSerde)
    )
    .filter((key, result) -> result.getDistance() < 0.5)  // 500m
    .to("proximity-alerts");
```

## 6. Detailed Flow: Real-Time Push to Customer

### 6.1. WebSocket Flow

```mermaid
sequenceDiagram
    participant Kafka as Kafka Topic<br/>processed-updates
    participant Consumer as Kafka Consumer<br/>(Goroutine)
    participant Hub as WebSocket Hub
    participant Conn as Customer<br/>WebSocket Connection

    Note over Consumer: Background goroutine<br/>continuously polls Kafka

    Kafka->>Consumer: Poll: batch of messages
    loop For each message
        Consumer->>Hub: BroadcastToDriver(driver_id, data)
        Hub->>Hub: Lookup connections:<br/>connections[driver_id]

        alt Has subscribers
            Hub->>Conn: ws.WriteJSON(data)
            Conn-->>Hub: ACK
        else No subscribers
            Hub->>Hub: Log: "No subscribers"
        end
    end

    Consumer->>Consumer: Commit offset to Kafka
```

### 6.2. WebSocket Hub Implementation (Golang)

```go
type Hub struct {
    connections map[string][]*websocket.Conn  // driver_id -> connections
    register    chan *Subscription
    unregister  chan *Subscription
    broadcast   chan *Message
    mu          sync.RWMutex
}

type Message struct {
    DriverID string
    Data     interface{}
}

func (h *Hub) Run() {
    // Kafka consumer goroutine
    go func() {
        for {
            msg := kafkaConsumer.ReadMessage(context.Background())
            var update LocationUpdate
            json.Unmarshal(msg.Value, &update)

            h.broadcast <- &Message{
                DriverID: update.DriverID,
                Data:     update,
            }
        }
    }()

    // Hub management goroutine
    for {
        select {
        case sub := <-h.register:
            h.mu.Lock()
            h.connections[sub.DriverID] = append(h.connections[sub.DriverID], sub.Conn)
            h.mu.Unlock()

        case sub := <-h.unregister:
            h.mu.Lock()
            conns := h.connections[sub.DriverID]
            for i, conn := range conns {
                if conn == sub.Conn {
                    h.connections[sub.DriverID] = append(conns[:i], conns[i+1:]...)
                    break
                }
            }
            h.mu.Unlock()

        case msg := <-h.broadcast:
            h.mu.RLock()
            conns := h.connections[msg.DriverID]
            h.mu.RUnlock()

            for _, conn := range conns {
                conn.WriteJSON(msg.Data)
            }
        }
    }
}
```

## 7. Detailed Flow: Trip Completion & Cost Calculation

```mermaid
sequenceDiagram
    actor Driver
    participant UI as Driver UI
    participant API as REST API
    participant DB as Cassandra

    Driver->>UI: Click "Mark as Delivered"
    UI->>API: PUT /api/orders/:id/status<br/>{ status: "DELIVERED" }

    API->>DB: UPDATE orders<br/>SET status='DELIVERED'

    API->>DB: SELECT * FROM trip_locations<br/>WHERE trip_id = ?<br/>ORDER BY timestamp ASC

    DB-->>API: [Array of GPS points]

    Note over API: Calculate Total Distance:<br/>FOR each pair of consecutive points:<br/>  distance += haversine(p1, p2)

    Note over API: Calculate Total Duration:<br/>duration = max(timestamp) - min(timestamp)

    Note over API: Calculate Cost:<br/>cost = base_fare +<br/>(distance_rate × total_distance) +<br/>(time_rate × total_duration/60)

    API->>DB: INSERT INTO trip_metadata<br/>VALUES (trip_id, ..., total_distance,<br/>total_duration, trip_cost)

    DB-->>API: Success
    API-->>UI: { trip_cost, total_distance, total_duration }
    UI-->>Driver: Display "Trip Complete!<br/>Cost: $9.35 (8.3 km, 22 min)"
```

## 8. Data Volume Estimates

### 8.1. Kafka Throughput

| Scenario | GPS Points/Second | Messages/Day | Storage (7 days) |
|----------|------------------|--------------|------------------|
| 10 drivers | 10 | 864,000 | ~60 MB |
| 100 drivers | 100 | 8,640,000 | ~600 MB |
| 1,000 drivers | 1,000 | 86,400,000 | ~6 GB |
| 10,000 drivers | 10,000 | 864,000,000 | ~60 GB |

**Assumptions:**
- 1 GPS point per second per driver
- Average message size: 150 bytes (JSON)
- Retention: 7 days for processed-updates

### 8.2. Cassandra Storage

| Table | Rows/Day (1000 drivers) | Storage/Day | Query Frequency |
|-------|-------------------------|-------------|-----------------|
| trip_locations | 86,400,000 | ~8 GB | Low (historical only) |
| trip_metadata | 5,000 | ~5 MB | Medium (per trip) |
| orders | 5,000 | ~2 MB | High (real-time status) |
| driver_analytics | 1,000 | ~1 MB | Low (weekly) |
| alerts | 10,000 | ~10 MB | Medium (admin dashboard) |

**Total Storage (1 year, 1000 drivers):** ~3 TB

## 9. Latency Breakdown

| Stage | Latency | Notes |
|-------|---------|-------|
| GPS Simulator → Kafka | 5-10 ms | Network + serialization |
| Kafka ingestion | 1-2 ms | Partition write |
| Kafka Streams processing | 10-50 ms | Topology execution + state store lookup |
| Kafka Streams → Cassandra | 5-10 ms | Async write |
| Kafka Streams → output topic | 1-2 ms | Partition write |
| Output topic → Go consumer | 5-10 ms | Poll interval |
| WebSocket push | 1-5 ms | Local broadcast |
| Browser rendering | 10-20 ms | DOM update |

**Total End-to-End:** ~50-100 ms (GPS → Customer UI)

---

**This document provides the complete data flow architecture for the real-time delivery tracking system.**
