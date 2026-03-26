# Research Report: Backend Implementation

**Date:** 2026-03-26 | **Stack:** Golang + Java/Kafka Streams + Cassandra

---

## 1. Golang Ingestion

**GPX Parsing:** `encoding/xml` (stdlib) - GPX is simple XML, no deps needed.

**Kafka Producer:** `segmentio/kafka-go` - Pure Go, ~50us latency, channel API.
| | segmentio | confluent |
|--|-----------|-----------|
| Latency | ~50us | ~200us |
| Schema Registry | No | Yes |

**Concurrency:** Worker pool with bounded goroutines (semaphore pattern).

**Config:** Environment variables (`os.Getenv`) - NOT viper (YAGNI).

---

## 2. Java Kafka Streams

**Build:** Gradle (Kotlin DSL) + Shadow JAR plugin. Single deployable JAR.

**RocksDB:** Default config with 2MB write buffers, 2 max buffers.
```java
props.put(StreamsConfig.NUM_STREAM_THREADS_CONFIG, 3);
props.put("rocksdb.config.setter", (storeName, options, configs) -> {
    options.setWriteBufferSize(2 * 1024 * 1024);
    options.setMaxWriteBufferNumber(2);
});
```

**KTable (destination lookup):**
```java
KTable<String, Destination> destTable = builder.table("orders",
    Consumed.with(Serdes.String(), destSerde),
    Materialized.as("destinations-store"));
```

**Testing:** `TopologyTestDriver` - pipe input, assert output.

---

## 3. Golang Serving

**Framework:** Gin (not Fiber) - Mature, ~50K rps sufficient.

**WebSocket:** `gorilla/websocket` - Standard since 2013. `neociclo` dead.

**Cassandra:** `gocql` - Official DataStax driver.

**Kafka Consumer:**
```go
reader := kafka.NewReader(kafka.ReaderConfig{
    Topic: "processed-updates", GroupID: "serving-service"})
go func() {
    for { msg, _ := reader.ReadMessage(ctx); hub.Broadcast(...); }()
}()
```

---

## 4. Cassandra Schema (per SPEC)

```sql
CREATE KEYSPACE delivery_tracking WITH REPLICATION = {'class': 'SimpleStrategy', 'replication_factor': 2};

CREATE TABLE orders (order_id UUID PRIMARY KEY, customer_id UUID, driver_id UUID,
    restaurant_location TEXT, delivery_location TEXT, status TEXT, created_at TIMESTAMP);

CREATE TABLE trip_locations (trip_id UUID, timestamp TIMESTAMP, driver_id UUID,
    latitude DOUBLE, longitude DOUBLE, speed DOUBLE, heading DOUBLE, accuracy DOUBLE,
    PRIMARY KEY (trip_id, timestamp)) WITH CLUSTERING ORDER BY (timestamp DESC);

CREATE TABLE trip_metadata (trip_id UUID PRIMARY KEY, driver_id UUID, order_id UUID,
    total_distance DOUBLE, total_duration INT, average_speed DOUBLE, max_speed DOUBLE,
    speeding_violations INT, trip_cost DECIMAL, status TEXT);

CREATE TABLE driver_analytics (driver_id UUID, week_start_date DATE, total_trips INT,
    total_distance DOUBLE, average_speed DOUBLE, speeding_violations INT,
    PRIMARY KEY (driver_id, week_start_date)) WITH CLUSTERING ORDER BY (week_start_date DESC);

CREATE TABLE alerts (alert_id UUID, driver_id UUID, trip_id UUID, timestamp TIMESTAMP,
    alert_type TEXT, severity TEXT, message TEXT, metadata MAP<TEXT, TEXT>,
    PRIMARY KEY (driver_id, timestamp, alert_id)) WITH CLUSTERING ORDER BY (timestamp DESC);
```

---

## 5. Docker Compose

```yaml
services:
  zookeeper: { image: confluentinc/cp-zookeeper:7.6.0, port: 2181 }
  kafka:     { image: confluentinc/cp-kafka:7.6.0, port: 9092, depends_on: zookeeper }
  cassandra: { image: cassandra:4.1, port: 9042 }
```

---

## 6. Key File Structure

```
├── cmd/simulator/main.go     # Golang GPX simulator
├── cmd/api/main.go           # Golang API + WebSocket
├── internal/gpx/parser.go    # stdlib XML
├── internal/kafka/producer.go# segmentio/kafka-go
├── internal/cassandra/dao.go # gocql
├── internal/websocket/hub.go # gorilla/websocket
├── stream-processor/          # Java Gradle project
└── docker-compose.yml
```

---

## 7. Recommendations

| Component | Choice | Reason |
|-----------|--------|--------|
| GPX Parser | stdlib | Zero deps |
| Kafka Client | segmentio/kafka-go | Pure Go, high perf |
| Web Framework | Gin | Mature |
| WebSocket | gorilla | Standard |
| Cassandra Driver | gocql | Official |
| Java Build | Gradle+Shadow | Single JAR |
| State Store | RocksDB default | Bounded |

---

## 8. Unresolved Questions

1. **Speed**: Compute from haversine or trust GPX `<speed>` tag?
2. **Driver assignment**: Simple nearest or complex matching?
3. **Auth**: Include JWT or open for demo?
4. **Alert writes**: In Streams or Go service?
5. **Compaction**: TWCS vs LCS for `trip_locations`?
