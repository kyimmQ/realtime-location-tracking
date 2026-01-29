# CLAUDE.md

This file serves as the primary engineering guide for Claude Code when working on the Real-Time Delivery Tracking System. It details the architecture, coding standards, and operational procedures for this polyglot codebase.

## 1. System Architecture

The system follows a high-performance polyglot architecture designed for sub-millisecond latency and high concurrency.

### Data Flow Pipeline
1.  **Ingestion (Golang):** Simulates thousands of concurrent drivers by parsing GPX files and producing to Kafka.
2.  **Message Broker (Kafka):** Handles real-time streams (`raw-gps-stream`, `driver-updates`, `driver-alerts`).
3.  **Processing (Java):** Kafka Streams application that acts as the "brain," performing windowed aggregations and geofencing.
4.  **Storage (Cassandra):** High-volume time-series storage for historical trip data.
5.  **API Layer (Golang):** REST and WebSocket gateway for the frontend.
6.  **Frontend (React):** Real-time visualization using Leaflet.

## 2. Technology Stack & Standards

### A. Infrastructure
-   **Docker Compose:** Orchestrates the entire stack (Kafka, Zookeeper, Cassandra, Services).
-   **Kafka:** Topics must be created with appropriate partition counts to support concurrency.
-   **Cassandra:** Use `trip_id` as Partition Key and `timestamp` (DESC) as Clustering Key.

### B. Ingestion Service (Golang)
-   **Location:** `/ingestion`
-   **Role:** Data Generator / Producer
-   **Key Libraries:** `github.com/segmentio/kafka-go`
-   **Concurrency:** Use strict Goroutines patterns. Each "driver" runs in its own goroutine.
-   **Data Quality:** strict JSON marshaling. Ensure float64 for coordinates.
-   **Conventions:**
    -   Follow standard Go project layout.
    -   Use `context` for cancellation and timeouts.
    -   Handle SIGTERM/SIGINT for graceful shutdown of producers.

### C. Stream Processing (Java)
-   **Location:** `/processing`
-   **Role:** Stream Processor
-   **Framework:** Apache Kafka Streams
-   **Key Logic:**
    -   **Windowing:** 30-second tumbling windows for average speed calculation.
    -   **Joins:** Stream-Stream or Stream-Table joins for geofencing.
    -   **Latency:** Optimize for sub-millisecond processing time.
-   **Build Tool:** Maven (`pom.xml`)
-   **Style:** Standard Java Google Style Guide.

### D. API Service (Golang)
-   **Location:** `/api`
-   **Role:** Backend & WebSocket Hub
-   **Framework:** Gin or Fiber (preferred for performance).
-   **Database Driver:** `gocql` for Cassandra interactions.
-   **WebSockets:** Efficient broadcasting map (DriverID -> List of Clients).
-   **API Design:** RESTful for history, WebSocket for live updates.

### E. Frontend (React)
-   **Location:** `/frontend`
-   **Stack:** React, TypeScript (recommended), Leaflet (react-leaflet).
-   **State Management:** Context API or lightweight store (Zustand/Redux) for managing live driver positions.
-   **Optimization:** Debounce map re-renders to handle high-frequency updates.

## 3. Development Commands

### Docker (Root)
-   Start all: `docker-compose up -d`
-   Stop all: `docker-compose down`
-   Logs: `docker-compose logs -f [service_name]`

### Golang Services
-   Test: `go test -v ./...`
-   Run: `go run cmd/main.go` (adjust based on actual entrypoint)
-   Lint: `golangci-lint run`

### Java Service
-   Package: `mvn clean package`
-   Run: `java -jar target/processing-app.jar`

### Frontend
-   Install: `npm install`
-   Dev: `npm start`
-   Build: `npm run build`

## 4. Implementation Constraints & Requirements
1.  **Real-Time Latency:** The critical path (Ingestion -> Processing -> API -> UI) must be minimized.
2.  **Concurrency:** Ingestion must demonstrate handling 1,000+ simulated drivers.
3.  **Data Integrity:** Validates GPS coordinates before ingestion.
4.  **Error Handling:** Never crash on malformed input; log and skip.

## 5. Code Style & Quality
-   **Comments:** rigorous godoc for exported Go symbols. Javadoc for Java interfaces.
-   **Commits:** Conventional Commits (e.g., `feat: add gpx parser`, `fix: kafka connection timeout`).
-   **Testing:** Unit tests for logic (speed calc, geofence check). Integration tests for DB/Kafka queries.
