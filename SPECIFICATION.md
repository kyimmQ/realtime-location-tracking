# Project Specification: Real-Time Delivery Tracking System

**Course:** Data Engineering (CO5173)  
**Application Domain:** Transportation & Supply Chain Management  
**Date:** Semester 2 - 2025-2026

---

## 1. Executive Summary

This project aims to build a data-driven application that simulates real-time delivery tracking, similar to services like Uber or Grab. The system adopts a high-performance **polyglot architecture**:

- **Golang** is used for high-concurrency tasks (Data Ingestion and API Serving).
- **Java** is leveraged for the **Kafka Streams** processing core to ensure sub-millisecond latency.
- **Apache Cassandra** serves as the high-volume storage engine for historical data.
- **React** provides the interactive, real-time user interface.

## 2. User Groups & Stakeholders

The application supports three distinct user groups, each with specific data needs:

- **Customers:** Need real-time visibility of their package status and accurate arrival estimates to reduce anxiety.
- **Drivers:** Need automated logging of their trips and safety monitoring to ensure compliance.
- **Fleet Managers (Admins):** Need aggregated data on driver performance, route efficiency, and safety violations for operational decision-making.

## 3. Business Requirements

_Constraint: Group of 4 members × 2 requirements = 8 total requirements._

### A. Real-Time Processing Requirements (Powered by Kafka Streams)

_These requirements are implemented using the Java Kafka Streams library for sub-millisecond latency._

1.  **Real-Time Location Tracking:** Ingest raw GPS coordinates, filter noise/errors, and broadcast the driver’s sanitized location to the user interface.
2.  **Dynamic ETA Calculation:** Continuously calculate Estimated Time of Arrival (ETA) based on the remaining distance and the driver’s current moving average speed.
3.  **Safety & Speed Limit Monitoring:** Detect speeding violations in real-time by calculating velocity between data points. Violations >60 km/h must trigger an immediate "Safety Alert" event.
4.  **Proximity Alerts (Geofencing):** The system must continuously monitor the distance between the driver and the delivery target. When the driver enters a 500m radius, a "Driver Approaching" notification is triggered.

### B. Data Management & Analytics Requirements (Powered by Cassandra)

_These requirements utilize the storage layer to analyze historical data at rest._

5.  **Trip History & Route Playback:** The system must store the full sequence of coordinates for every completed trip, allowing admins to visually replay a route for dispute resolution.
6.  **Driver Performance Analytics:** The system must aggregate historical data to generate weekly performance reports, including "Total Distance Traveled," "Average Speed," and "Idle Time" per driver.
7.  **Automated Delivery Cost Calculation:** The system must accurately calculate the final billable cost based on the _actual_ distance traveled and duration recorded in the database, rather than estimated paths.
8.  **Service Area Heatmaps:** The system must query historical drop-off locations to identify high-demand zones (hotspots), aiding in strategic fleet positioning.

## 4. System & Data Architecture

### 4.1. Technology Stack

| Component         | Technology          | Language       | Justification                                                                                                                    |
| :---------------- | :------------------ | :------------- | :------------------------------------------------------------------------------------------------------------------------------- |
| **Ingestion**     | Kafka Producer      | **Golang**     | **Goroutines** allow us to simulate thousands of concurrent drivers (streams) from a single machine with minimal resource usage. |
| **Processing**    | **Kafka Streams**   | **Java**       | Native support for stateful stream processing (Windowing, KTable) and lowest latency.                                            |
| **Storage**       | Cassandra           | CQL            | Best-in-class write throughput for time-series data; handles massive write loads linearly.                                       |
| **Serving (API)** | **Gin/Fiber**       | **Golang**     | High-performance REST and WebSocket handling; shares data structures/models with the Ingestion layer.                            |
| **Frontend**      | **React + Leaflet** | **JavaScript** | Component-based architecture for efficient rendering of dynamic map markers.                                                     |

### 4.2. Data Ingestion: Golang Producer

- **Role:** The Data Generator.
- **Implementation:** A Golang command-line tool that parses GPX files.
- **Concurrency Model:** It spawns a lightweight **goroutine** for every "active driver." Each goroutine reads a GPX file line-by-line and publishes JSON messages to the `raw-gps-stream` Kafka topic at precise time intervals (e.g., waiting 1 second between points to simulate real-time driving).

### 4.3. Data Processing: Kafka Streams (Java)

- **Role:** The Processing Core ("The Brain").
- **Implementation:** A robust Java application.
- **Logic:** It consumes the `raw-gps-stream`. It uses **Windowed Aggregations** to calculate average speed over the last 30 seconds and **Stream-Table Joins** to check geofences.
- **Output:** It writes cleaned data to `driver-updates` (for the Map) and `driver-alerts` (for Safety Warnings).

### 4.4. Data Management: Apache Cassandra

- **Role:** The System of Record.
- **Schema Design:**
  - **Table:** `trip_data`
  - **Partition Key:** `trip_id` (To group all points of a single trip together).
  - **Clustering Key:** `timestamp` (DESC) (To keep points ordered by time, allowing fast retrieval of the "latest" location or the full path).

### 4.5. Application Layer: Golang API

- **Role:** The Bridge.
- **WebSocket Hub:** A centralized Go service that subscribes to the `driver-updates` Kafka topic. When it receives a message, it efficiently broadcasts it to the specific React client tracking that driver.
- **History API:** Exposes REST endpoints (e.g., `GET /trips/:id/history`) that execute optimized CQL queries against Cassandra to fetch past routes.

## 5. Alternative Solutions (Benchmarking)

To justify our technology choices, we compared our **Golang Ingestion** approach against a standard **Python Script** approach:

| Feature              | Selected: **Golang Ingestion**                                                                | Alternative: **Python Script**                                                                         |
| :------------------- | :-------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------- |
| **Simulation Scale** | **High:** Can simulate 10,000+ concurrent drivers using Goroutines.                           | **Low:** Threads are heavy; Global Interpreter Lock (GIL) limits true concurrency.                     |
| **Type Safety**      | **Strong:** JSON structs are defined once and compiled. Ensures data entering Kafka is valid. | **Weak:** Easy to accidentally send malformed JSON types (e.g., string instead of float for Lat/Long). |
| **Performance**      | **Compiled:** Extremely fast startup and execution.                                           | **Interpreted:** Slower loop execution for massive file parsing.                                       |

## 6. Deliverables & Roadmap

- **Week 1: Infrastructure & Ingestion (Golang)**
  - Setup Kafka & Cassandra via Docker Compose.
  - Develop **Go Producer**: Implement GPX parser and Kafka Writer using `segmentio/kafka-go`.
- **Week 2: Stream Processing (Java)**
  - Develop **Java Kafka Streams** app.
  - Implement "Speed Calculation" logic and "Filter" topologies.
  - _Deliverable:_ A running JAR file that consumes raw data and outputs enriched data.
- **Week 3: API Development (Golang)**
  - Develop **Go Backend**:
    - Implement Cassandra DAO (Data Access Object) using `gocql`.
    - Implement WebSocket Hub for real-time streaming.
- **Week 4: Frontend Implementation (React)**
  - Initialize React project.
  - Integrate `react-leaflet` for OpenStreetMap.
  - Connect to Go WebSockets to visualize the moving cars.

## 7. Evaluation Criteria

1.  **Throughput:** How many concurrent driver simulations (Go routines) can the system handle before Kafka lags?
2.  **Data Consistency:** Do the structs in the Golang Producer match the schema expected by the Java Processor?
3.  **End-to-End Latency:** Time from "Go Producer Publish" -> "Java Process" -> "Go API Broadcast" -> "React Render".
