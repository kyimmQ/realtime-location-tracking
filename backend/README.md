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

## Project Structure (Phase 1)

```
backend/
├── scripts/
│   ├── init-cql.cql          # Cassandra schema initialization (5 tables)
│   └── start.sh              # Orchestration script to start infrastructure
└── docker-compose.yml        # Services: Zookeeper, Kafka, Cassandra
```

## Getting Started

### Prerequisites

* Docker
* Docker Compose

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

### Stopping the Infrastructure

To shut down the infrastructure:

```bash
docker compose down
```
*(Use `docker compose down -v` to tear down the volumes as well if you want a clean slate).*
