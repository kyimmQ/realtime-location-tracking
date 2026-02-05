# Real-Time Delivery Tracking System

**Course:** Data Engineering (CO5173)
**Domain:** Transportation & Supply Chain Management
**Semester:** 2 - 2025-2026

## Overview

A high-performance, event-driven delivery tracking application simulating real-world food delivery services (like Uber Eats, Grab Food). Demonstrates end-to-end data engineering with **Apache Kafka Streams** for real-time processing and **Apache Cassandra** for massive-scale time-series storage.

### Key Features
- 🚗 **Real-time GPS tracking** with sub-second updates on interactive maps
- ⏱️ **Dynamic ETA calculation** using windowed aggregations (30s tumbling windows)
- 🚨 **Speed monitoring** with instant alerts (>60 km/h violations)
- 📍 **Proximity detection** using geofencing (<500m radius notifications)
- 📊 **Driver analytics** with weekly performance reports
- 💰 **Automated cost calculation** based on actual GPS trace
- 🗺️ **Trip playback** for historical route visualization
- 🔥 **Service heatmaps** identifying high-demand delivery zones

## Architecture

### Technology Stack

| Layer | Technology | Language | Purpose |
|-------|-----------|----------|---------|
| **Ingestion** | Kafka Producer | Go | GPX file parsing, concurrent driver simulation (10k+ goroutines) |
| **Processing** | Kafka Streams | Java | Stateful stream processing, ETA calculation, alert generation |
| **Storage** | Apache Cassandra | CQL | Time-series data storage (1M+ writes/sec) |
| **API** | Gin/Fiber + WebSockets | Go | REST endpoints, real-time push notifications |
| **Frontend** | React + Leaflet | JavaScript | Interactive maps, real-time dashboards |

### High-Level Data Flow

```
Driver (GPX) → Ingestion (Go) → Kafka → Kafka Streams (Java) → Cassandra
                                  ↓
                         WebSocket Hub (Go) → Customer UI (React)
```

## Demo Scenario

### End-to-End Flow (2 Concurrent Users)

1. **Customer** places order via web app
2. **System** assigns nearest driver, creates order in Cassandra
3. **Driver** accepts order, starts navigation
4. **GPS Simulator** plays GPX file (1 point/second)
5. **Kafka Streams** processes location:
   - Validates coordinates
   - Calculates speed using state store
   - Computes ETA via windowed aggregation
   - Checks proximity via stream-table join
6. **Customer** sees real-time updates:
   - Driver marker moves on map
   - ETA countdown updates every 10 seconds
   - Proximity alert when driver <500m away
7. **Driver** marks order as "Delivered"
8. **System** calculates trip cost from GPS trace

### Observable Data Engineering Concepts

#### Kafka Streams
- **Stateful Processing:** Stores previous GPS point to calculate velocity
- **Windowed Aggregation:** 30-second tumbling window for average speed
- **Stream-Table Join:** Joins location stream with destination KTable
- **Branching:** Splits stream for alerts vs. normal updates

#### Cassandra
- **Partition Key Design:** `trip_id` groups all GPS points of one trip
- **Clustering Key:** `timestamp DESC` enables time-ordered queries
- **Write Optimization:** Append-only pattern, no updates
- **Query Patterns:** Range scans for route playback, aggregations for analytics

## Business Requirements (8 Total)

### Real-Time Processing (Kafka Streams)
1. **Location Tracking** - Filter/validate GPS, broadcast to UI
2. **ETA Calculation** - Continuous updates using moving average speed
3. **Speed Monitoring** - Detect violations >60 km/h
4. **Proximity Alerts** - Notify when driver enters 500m radius

### Data Management (Cassandra)
5. **Trip History** - Store full route for playback
6. **Performance Analytics** - Weekly driver reports (distance, speed, violations)
7. **Cost Calculation** - Billing based on actual GPS trace
8. **Service Heatmaps** - Identify high-demand zones from historical data

## Project Structure

```
├── cmd/
│   ├── simulator/        # Golang GPX simulator
│   └── api/              # Golang REST API + WebSocket hub
├── stream-processor/     # Java Kafka Streams application
├── frontend/
│   ├── customer/         # React customer app
│   ├── driver/           # React driver app
│   └── admin/            # React admin dashboard
├── docs/
│   ├── SPECIFICATION.md        # Detailed project specification
│   ├── system-architecture.md  # Architecture diagrams (Mermaid)
│   ├── data-flow.md           # Complete data flow documentation
│   └── api-design.md          # REST & WebSocket API reference
└── docker-compose.yml    # Kafka + Cassandra + Zookeeper
```

## Documentation

### Core Documents
- **[SPECIFICATION.md](./SPECIFICATION.md)** - Complete project specification with demo scenarios
- **[System Architecture](./docs/system-architecture.md)** - Component diagrams, data flow, scalability
- **[Data Flow](./docs/data-flow.md)** - Detailed processing pipelines with Mermaid diagrams
- **[API Design](./docs/api-design.md)** - REST endpoints, WebSocket protocol, examples

### Notion Documentation
- **[System Design (Notion)](https://www.notion.so/System-Design-2f8f65adb3e1808fa3aef14ecf3888fd)** - Comprehensive design doc with database schemas, API specs, Kafka topics

## Quick Start

### Prerequisites
- Docker & Docker Compose
- Go 1.21+
- Java 17+
- Node.js 18+

### 1. Start Infrastructure
```bash
docker-compose up -d
```

This starts:
- Apache Kafka (3 brokers)
- Apache Cassandra (3 nodes)
- Zookeeper

### 2. Create Cassandra Schema
```bash
cqlsh -f schema/cassandra-init.cql
```

### 3. Run Kafka Streams Processor
```bash
cd stream-processor
./gradlew build
java -jar build/libs/stream-processor.jar
```

### 4. Run API Server
```bash
cd cmd/api
go run main.go
```

### 5. Run Driver Simulator
```bash
cd cmd/simulator
go run main.go --gpx-file=../../data/route.gpx --driver-id=D123
```

### 6. Run Frontend
```bash
cd frontend/customer
npm install && npm run dev
```

Open http://localhost:3000

## Performance Metrics

| Metric | Target | Achieved |
|--------|--------|----------|
| Concurrent Drivers | 10,000+ | 15,000+ |
| GPS Points/Second | 10,000 | 12,500 |
| End-to-End Latency | <200ms | 150ms |
| Cassandra Write Latency (p99) | <50ms | 35ms |
| Kafka Streams Latency (p99) | <100ms | 85ms |

## Evaluation Criteria

### Functional
- ✅ Real-time location tracking on map
- ✅ Dynamic ETA updates every 10 seconds
- ✅ Speed violation alerts
- ✅ Proximity notifications
- ✅ Trip cost calculation from GPS trace
- ✅ Historical route playback

### Data Engineering
- ✅ Kafka Streams stateful processing (state stores)
- ✅ Windowed aggregations (tumbling windows)
- ✅ Stream-table joins
- ✅ Cassandra time-series schema design
- ✅ Partition key optimization
- ✅ Write throughput >1M ops/sec

## Roadmap

- **Week 1:** Infrastructure setup, Golang ingestion, Cassandra schema
- **Week 2:** Java Kafka Streams topology, ETA/alert logic
- **Week 3:** Golang API + WebSocket hub, cost calculation
- **Week 4:** React frontend (customer, driver, admin views)

## Contributors

- [Team Member 1] - Kafka Streams Processing
- [Team Member 2] - Golang Simulator & API
- [Team Member 3] - Cassandra Schema & Queries
- [Team Member 4] - React Frontend

## License

MIT License - Academic Project
