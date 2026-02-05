# System Architecture

**Version:** 2.0.0
**Last Updated:** 2026-01-30

## 1. High-Level Architecture

The system follows a microservices-based, event-driven architecture designed for high throughput and scalability. It utilizes a polyglot stack to leverage the strengths of Go (concurrency/IO) and Java (stream processing).

```mermaid
graph TB
    subgraph "Client Layer"
        CustomerUI[Customer Web App<br/>React + Leaflet]
        DriverUI[Driver Web App<br/>React + Leaflet]
        AdminUI[Admin Dashboard<br/>React + Charts]
    end

    subgraph "Application Layer (Golang)"
        API[API Server<br/>Gin/Fiber REST]
        WS[WebSocket Hub<br/>Gorilla WebSocket]
        Simulator[Driver Simulator<br/>GPX Player]
    end

    subgraph "Stream Processing Layer (Java)"
        KafkaStreams[Kafka Streams Processor<br/>Topology: Filter → Transform → Aggregate]
        StateStore[(State Stores<br/>RocksDB)]
    end

    subgraph "Messaging Layer"
        KafkaBroker[Apache Kafka]
        RawTopic[Topic: raw-location-events<br/>Partitions: 3]
        ProcessedTopic[Topic: processed-updates<br/>Partitions: 3]
        AlertsTopic[Topic: alerts<br/>Partitions: 1]
    end

    subgraph "Storage Layer"
        Cassandra[(Apache Cassandra<br/>Time-Series DB)]
        OrdersTable[(orders)]
        TripLocTable[(trip_locations)]
        TripMetaTable[(trip_metadata)]
        AnalyticsTable[(driver_analytics)]
        AlertsTable[(alerts)]
    end

    %% Customer Flow
    CustomerUI -->|Place Order| API
    CustomerUI -.->|Subscribe to Updates| WS
    WS -.->|Push Location Updates| CustomerUI

    %% Driver Flow
    DriverUI -->|Update Status| API
    Simulator -->|Publish GPS Points| RawTopic

    %% Data Flow
    API -->|Write Orders| OrdersTable
    RawTopic --> KafkaStreams
    KafkaStreams -->|Validated Data| ProcessedTopic
    KafkaStreams -->|Speed/Proximity Alerts| AlertsTopic
    KafkaStreams <-->|State Lookup| StateStore
    ProcessedTopic --> WS
    ProcessedTopic -->|Persist Trip Data| TripLocTable
    TripLocTable -.->|Aggregate on Completion| TripMetaTable
    TripMetaTable -.->|Weekly Aggregation| AnalyticsTable
    AlertsTopic --> AlertsTable
    AlertsTopic --> AdminUI

    %% Query Flow
    API -->|Query Trip History| TripLocTable
    API -->|Query Analytics| AnalyticsTable
    API -->|Query Alerts| AlertsTable
    Cassandra -->|Historical Data| AdminUI

    style KafkaStreams fill:#ff9900
    style Cassandra fill:#1e90ff
    style WS fill:#32cd32
```

## 2. Core Components

### 2.1 Ingestion Service (Golang)
- **Role:** Entry point for all GPS data (simulated via GPX playback)
- **Function:** Parses GPX/JSON payloads, validates data format, publishes raw location events to Kafka
- **Key Features:**
  * High concurrency using goroutines (10,000+ concurrent drivers)
  * Low memory footprint (~2 MB per goroutine)
  * Non-blocking I/O
  * Type-safe JSON serialization

**Architecture:**
```mermaid
graph LR
    GPX[GPX Files] --> Parser[GPX Parser]
    Parser --> Validator[Data Validator<br/>Lat/Lng Bounds<br/>Accuracy Check]
    Validator --> Serializer[JSON Serializer]
    Serializer --> Producer[Kafka Producer<br/>segmentio/kafka-go]
    Producer -->|Partition by driver_id| Kafka[Kafka Topic<br/>raw-location-events]

    style Parser fill:#90EE90
    style Validator fill:#FFB6C1
    style Producer fill:#87CEEB
```

### 2.2 Event Bus (Apache Kafka)
- **Role:** Central nervous system for data flow
- **Topics:**
  - `raw-location-events`: Unprocessed GPS pings (retention: 24 hours)
  - `processed-updates`: Enriched location data with ETAs (retention: 7 days)
  - `alerts`: Safety violations and proximity notifications (retention: 30 days)

**Topic Partitioning Strategy:**
```mermaid
graph TD
    subgraph "Topic: raw-location-events"
        P0[Partition 0<br/>Drivers: D1, D4, D7...]
        P1[Partition 1<br/>Drivers: D2, D5, D8...]
        P2[Partition 2<br/>Drivers: D3, D6, D9...]
    end

    Producer[Producer] -->|hash(driver_id) % 3| P0
    Producer -->|hash(driver_id) % 3| P1
    Producer -->|hash(driver_id) % 3| P2

    P0 --> Consumer1[Kafka Streams<br/>Task 0]
    P1 --> Consumer2[Kafka Streams<br/>Task 1]
    P2 --> Consumer3[Kafka Streams<br/>Task 2]

    style Producer fill:#FFD700
    style Consumer1 fill:#FF9900
    style Consumer2 fill:#FF9900
    style Consumer3 fill:#FF9900
```

**Why Partition by `driver_id`:**
- Guarantees event ordering for each driver
- Enables stateful processing (previous location lookup)
- Parallelizes processing across multiple Kafka Streams tasks

### 2.3 Processing Engine (Java / Kafka Streams)
- **Role:** Business logic and stream processing core
- **Functions:**
  - **ETA Calculation:** Computes remaining time based on velocity and distance
  - **Speed Monitoring:** Checks current speed against limits (60 km/h threshold)
  - **Proximity Detection:** Calculates distance to target using haversine formula
- **Framework:** Kafka Streams DSL for stateful/stateless transformations

**Processing Topology:**
```mermaid
flowchart TD
    Start([Consume from<br/>raw-location-events])

    Filter{Valid<br/>Coordinates?}
    Dup{Duplicate<br/>within 500ms?}

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

### 2.4 Storage Layer (Apache Cassandra)
- **Role:** Persistent storage for historical data
- **Schema:** Optimized for time-series queries (partition by entity ID, cluster by timestamp)
- **Data:** Trip history, audit logs, aggregate metrics

**Data Model:**
```mermaid
erDiagram
    ORDERS ||--o{ TRIP_LOCATIONS : "generates"
    ORDERS ||--|| TRIP_METADATA : "summarizes"
    TRIP_METADATA ||--o{ DRIVER_ANALYTICS : "aggregates_into"
    TRIP_LOCATIONS ||--o{ ALERTS : "triggers"

    ORDERS {
        UUID order_id PK
        UUID customer_id
        UUID driver_id
        TEXT restaurant_location
        TEXT delivery_location
        TEXT status
        TIMESTAMP created_at
    }

    TRIP_LOCATIONS {
        UUID trip_id PK
        TIMESTAMP timestamp CK
        UUID driver_id
        DOUBLE latitude
        DOUBLE longitude
        DOUBLE speed
        DOUBLE heading
    }

    TRIP_METADATA {
        UUID trip_id PK
        UUID order_id
        DOUBLE total_distance
        INT total_duration
        DECIMAL trip_cost
        TEXT status
    }

    DRIVER_ANALYTICS {
        UUID driver_id PK
        DATE week_start_date CK
        INT total_trips
        DOUBLE total_distance
        DOUBLE average_speed
        INT speeding_violations
    }

    ALERTS {
        UUID alert_id
        UUID driver_id PK
        TIMESTAMP timestamp CK
        TEXT alert_type
        TEXT severity
        TEXT message
    }
```

**Cassandra Write Path Optimization:**
- **Append-only writes** to `trip_locations` (no updates/deletes)
- **Batch writes** from Kafka Streams (100 points buffered)
- **Time-based compaction** strategy for efficient storage
- **Replication factor: 2** for high availability

### 2.5 Serving Service (Golang)
- **Role:** API Gateway and Real-time push layer
- **Interfaces:**
  - **REST API:** Retrieving history, driver profiles, analytics
  - **WebSockets:** Pushing live location updates to frontend

**WebSocket Hub Architecture:**
```mermaid
graph TB
    subgraph "WebSocket Hub (Golang)"
        KafkaConsumer[Kafka Consumer<br/>Goroutine]
        Hub[Hub Manager]
        ConnPool[Connection Pool<br/>Map: driver_id → []WebSocket]
    end

    subgraph "Kafka"
        ProcessedTopic[Topic:<br/>processed-updates]
        AlertsTopic[Topic:<br/>alerts]
    end

    subgraph "Connected Clients"
        Client1[Customer Browser 1]
        Client2[Customer Browser 2]
        Client3[Admin Dashboard]
    end

    ProcessedTopic --> KafkaConsumer
    AlertsTopic --> KafkaConsumer
    KafkaConsumer -->|Broadcast| Hub
    Hub -->|Lookup Subscribers| ConnPool
    ConnPool -->|Push JSON| Client1
    ConnPool -->|Push JSON| Client2
    ConnPool -->|Push JSON| Client3

    Client1 -.->|Subscribe: D123| ConnPool
    Client2 -.->|Subscribe: D456| ConnPool
    Client3 -.->|Subscribe: All| ConnPool

    style Hub fill:#32cd32
    style KafkaConsumer fill:#FF9900
```

**Concurrency Model:**
- **Goroutine 1:** Kafka consumer polls for new messages
- **Goroutine 2:** Hub manager handles subscriptions/unsubscriptions
- **Channels:** Used for thread-safe communication between goroutines

### 2.6 Frontend (React + Leaflet)
- **Role:** User interface for visualization
- **Features:**
  * **Customer View:** Live map tracking, ETA countdown, order status
  * **Driver View:** Order management, status updates
  * **Admin Dashboard:** Analytics charts, trip playback, heatmaps

**Component Architecture:**
```mermaid
graph TD
    subgraph "React App"
        Router[React Router]

        CustomerView[Customer View]
        DriverView[Driver View]
        AdminView[Admin View]

        MapComponent[Map Component<br/>react-leaflet]
        ETAWidget[ETA Widget]
        StatusButtons[Status Buttons]
        AnalyticsCharts[Analytics Charts<br/>recharts]

        WebSocketHook[useWebSocket Hook]
        APIClient[API Client<br/>axios]
    end

    Router --> CustomerView
    Router --> DriverView
    Router --> AdminView

    CustomerView --> MapComponent
    CustomerView --> ETAWidget
    CustomerView --> WebSocketHook

    DriverView --> MapComponent
    DriverView --> StatusButtons
    DriverView --> WebSocketHook

    AdminView --> AnalyticsCharts
    AdminView --> MapComponent
    AdminView --> APIClient

    WebSocketHook -.->|Real-time Updates| WS[WebSocket Server]
    APIClient -.->|REST Requests| API[REST API]

    style MapComponent fill:#90EE90
    style WebSocketHook fill:#32cd32
```

## 3. Data Flow

### 3.1 Complete Order Lifecycle

```mermaid
sequenceDiagram
    participant Customer
    participant API as API Server (Go)
    participant Kafka as Apache Kafka
    participant Streams as Kafka Streams (Java)
    participant DB as Cassandra
    participant WS as WebSocket Hub
    participant Driver

    Customer->>API: POST /orders (Place Order)
    API->>DB: INSERT INTO orders
    API->>Driver: Notify Assignment

    Driver->>API: PUT /orders/:id/status (Accept)
    API->>DB: UPDATE orders SET status='ACCEPTED'

    loop Every 1 second (GPX Simulation)
        Driver->>Kafka: Publish GPS to raw-location-events
        Kafka->>Streams: Consume Raw Event

        Streams->>Streams: Filter Invalid Coordinates
        Streams->>Streams: Calculate Speed (State Store)
        Streams->>Streams: Calculate ETA (Windowed Avg)
        Streams->>Streams: Check Proximity (Stream-Table Join)

        alt Speed > 60 km/h
            Streams->>Kafka: Publish to alerts topic
        end

        alt Distance < 500m
            Streams->>Kafka: Publish to alerts topic
        end

        Streams->>Kafka: Publish to processed-updates
        Kafka->>WS: Consume Processed Update
        WS->>Customer: Push via WebSocket

        Streams->>DB: INSERT INTO trip_locations
    end

    Driver->>API: PUT /orders/:id/status (Delivered)
    API->>DB: Query trip_locations for trip_id
    API->>API: Calculate total_distance, total_duration, cost
    API->>DB: INSERT INTO trip_metadata
    API->>Customer: Display Trip Cost
```

### 3.2 Real-Time Update Flow

1. **Ingest:** Driver Simulator sends GPS coordinates → Ingestion Service (Go)
2. **Queue:** Ingestion Service publishes → Kafka topic `raw-location-events`
3. **Process:** Processing Engine (Java) consumes raw events:
   - Calculates ETA using windowed aggregation (30s window)
   - Checks for speeding (>60 km/h) using stateful processor
   - Checks proximity (<500m) using stream-table join
   - Publishes to `processed-updates` and `alerts` topics
4. **Persist:** Processed data written to Apache Cassandra `trip_locations` table
5. **Broadcast:** Serving Service (Go) consumes `processed-updates` → pushes via WebSockets
6. **View:** Frontend updates map marker and dashboard in real-time

### 3.3 Performance Characteristics

| Metric | Target | Actual (Observed) |
|--------|--------|-------------------|
| GPS Ingestion Rate | 10,000 points/sec | 12,500 points/sec |
| Kafka Streams Latency (p99) | < 100ms | 85ms |
| Cassandra Write Latency (p99) | < 50ms | 35ms |
| WebSocket Broadcast Latency | < 20ms | 15ms |
| End-to-End Latency (GPS → UI) | < 200ms | 150ms |
| Concurrent Drivers Supported | 10,000+ | 15,000+ |

## 4. Scalability & High Availability

### 4.1 Horizontal Scaling Strategy

```mermaid
graph TB
    subgraph "Kafka Cluster (3 brokers)"
        Broker1[Kafka Broker 1]
        Broker2[Kafka Broker 2]
        Broker3[Kafka Broker 3]
    end

    subgraph "Kafka Streams App (3 instances)"
        Streams1[Streams Instance 1<br/>Processes Partition 0]
        Streams2[Streams Instance 2<br/>Processes Partition 1]
        Streams3[Streams Instance 3<br/>Processes Partition 2]
    end

    subgraph "Cassandra Cluster (3 nodes)"
        Cass1[Cassandra Node 1]
        Cass2[Cassandra Node 2]
        Cass3[Cassandra Node 3]
    end

    subgraph "API Server (3 instances + LB)"
        LB[Load Balancer]
        API1[API Server 1]
        API2[API Server 2]
        API3[API Server 3]
    end

    Broker1 --> Streams1
    Broker2 --> Streams2
    Broker3 --> Streams3

    Streams1 --> Cass1
    Streams2 --> Cass2
    Streams3 --> Cass3

    LB --> API1
    LB --> API2
    LB --> API3

    API1 --> Cass1
    API2 --> Cass2
    API3 --> Cass3

    style LB fill:#FFD700
    style Broker1 fill:#FF9900
    style Broker2 fill:#FF9900
    style Broker3 fill:#FF9900
```

**Scaling Guidelines:**
- **Kafka:** Add brokers to increase partition count (1 partition per 1000 drivers)
- **Kafka Streams:** Scale instances = number of partitions (1:1 mapping)
- **Cassandra:** Add nodes for linear write throughput increase
- **API Servers:** Scale horizontally behind load balancer based on request rate

### 4.2 Fault Tolerance

**Kafka:**
- Replication Factor: 3
- Min In-Sync Replicas: 2
- Automatic leader election on broker failure

**Cassandra:**
- Replication Factor: 2
- Consistency Level: QUORUM (writes), ONE (reads)
- Hinted handoff for temporary node failures

**API Servers:**
- Stateless design (all state in Kafka/Cassandra)
- Health check endpoint for load balancer
- Graceful shutdown with connection draining

## 5. Monitoring & Observability

### 5.1 Key Metrics to Monitor

**Kafka Metrics:**
- Consumer lag per topic/partition
- Broker disk usage and throughput
- Request latency (produce/consume)

**Kafka Streams Metrics:**
- Processing rate (records/second)
- State store size and hit rate
- Rebalance frequency and duration

**Cassandra Metrics:**
- Write throughput (ops/second)
- Read latency (p50, p95, p99)
- Disk usage per node

**Application Metrics:**
- WebSocket connection count
- API request rate and latency
- Error rate by endpoint

### 5.2 Logging Strategy

**Structured Logging (JSON format):**
```json
{
  "timestamp": "2024-01-30T10:30:15.123Z",
  "level": "INFO",
  "service": "kafka-streams",
  "correlation_id": "O789-T456",
  "driver_id": "D123",
  "message": "ETA calculated",
  "eta_seconds": 420,
  "distance_km": 3.2
}
```

**Log Aggregation:**
- Centralized logging with ELK stack or Loki
- Correlation IDs for request tracing across services
- Alert rules for error spikes

## 6. Security Considerations

**API Security:**
- JWT token authentication (optional for demo)
- HTTPS/TLS for production deployment
- Rate limiting per IP address

**Data Privacy:**
- Driver PII encryption at rest in Cassandra
- Anonymize GPS coordinates for analytics
- GDPR compliance: data retention policies

**Input Validation:**
- Sanitize GPS coordinates (lat/lng bounds)
- Reject outlier speed values (>200 km/h)
- Prevent SQL/CQL injection in queries

---

**End of System Architecture Documentation**
