# Real-Time Delivery Tracking System - Backend

This is the backend infrastructure component of the Real-Time Delivery Tracking System, part of the Data Engineering (CO5173) course project. It provides the foundation for massive-scale time-series storage and high-throughput stream processing.

## Overview

The backend system is designed to handle high-concurrency data ingestion and real-time processing:
* **Kafka Streams**: Used for stateful stream processing, calculating dynamic ETA, detecting proximity, and monitoring speed violations in real-time.
* **Cassandra**: Used for time-series data storage, maintaining complete GPS traces for route playback, driver analytics, and tracking the order lifecycle.

## Tech Stack
* **Messaging Layer**: Apache Kafka (with Zookeeper)
* **Storage Layer**: Apache Cassandra (Time-Series Database)
* **Containerization**: Docker Compose

## Project Structure

```
backend/
├── scripts/
│   ├── init-cql.cql          # Cassandra schema initialization (5 tables)
│   └── start.sh              # Orchestration script to start infrastructure
├── src/                      # Golang Ingestion Service (Simulator & API)
├── stream-processor/         # Java Kafka Streams Processor
└── docker-compose.yml        # Services: Zookeeper, Kafka, Cassandra
```

## Getting Started

### Prerequisites

* Docker
* Docker Compose
* Java 21 (for the stream processor)
* Go 1.21+ (for the backend API/simulator)

### Installation

1. Navigate to the `backend` directory:
```bash
cd backend
```

2. Make the orchestration script executable (if not already):
```bash
chmod +x scripts/start.sh
```

### Running the Infrastructure

To start the Kafka broker, Zookeeper, and Cassandra database, run the start script:

```bash
./scripts/start.sh
```

The script will automatically:
1. Spin up the containers in the background.
2. Wait for Cassandra to become available and initialize the `delivery_tracking` keyspace alongside the 5 tables: `orders`, `trip_locations`, `trip_metadata`, `driver_analytics`, and `alerts`.
3. Wait for Kafka to become available and create the 3 required topics: `raw-location-events`, `processed-updates`, and `alerts`.

### Running the Stream Processor (Phase 3)

The Java stream processor consumes raw location events, calculates speed, ETA, and checks for proximity.

1. Navigate to the stream processor directory:
```bash
cd backend/stream-processor
```

2. Build the fat JAR:
```bash
./gradlew shadowJar
```

3. Run the application (assuming Kafka is running locally on port 9092):
```bash
java -jar app/build/libs/stream-processor.jar localhost:9092
```

#### Verifying Processor Output

While the processor and simulator are running, you can monitor the topics using Kafka's built-in console consumer (via the Docker container):

**Monitor Processed Updates:**
```bash
docker exec kafka kafka-console-consumer --topic processed-updates --from-beginning --bootstrap-server localhost:9092
```

**Monitor Alerts (Speeding and Proximity):**
```bash
docker exec kafka kafka-console-consumer --topic alerts --from-beginning --bootstrap-server localhost:9092
```

### Running the Serving API (Phase 4)

The Golang serving API handles REST endpoints, real-time WebSocket communication, and integrates with Cassandra and Kafka.

1. Navigate to the API source directory:
```bash
cd backend/src
```

2. Run the application:
```bash
go run cmd/api/main.go
```

The API will expose endpoints at `http://localhost:8080` and the WebSocket hub at `ws://localhost:8080/ws/tracking`.

### Running the Cost Calculation Service (Phase 5)

The Cost Calculation Service is automatically triggered via the Serving API when an order is marked as `DELIVERED`.

1. **Trigger Calculation:**
   Send a `PUT` request to `/api/orders/:id/status` with `{"status": "DELIVERED"}`.

2. **What Happens Automatically:**
   - The backend queries all GPS points for the trip from Cassandra.
   - It computes total distance using the Haversine formula, along with total duration, average speed, and speeding violations.
   - It calculates the final cost using the pricing formula: `cost = base_fare + (distance_rate × total_distance) + (time_rate × total_duration)`.
   - It writes the final summary and trip cost into the `trip_metadata` table, marking the trip as `COMPLETED`.

### Stopping the Infrastructure

To shut down the infrastructure:

```bash
cd backend
docker compose down
```
*(Use `docker compose down -v` to tear down the volumes as well if you want a clean slate).*
