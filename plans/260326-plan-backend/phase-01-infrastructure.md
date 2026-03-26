---
title: "Phase 1: Infrastructure Setup"
description: "Docker Compose with Kafka + Zookeeper + Cassandra; full 5-table CQL schema + 3 Kafka topics"
status: pending
priority: P1
effort: 2h
branch: main
tags: [backend, infrastructure, cassandra, kafka]
created: 2026-03-26
---

# Phase 1: Infrastructure Setup

## Context Links

- Parent: [plan.md](./plan.md)
- Spec: `SPECIFICATION.md` (Cassandra Schema §5.6, Kafka Topics §6)

## Overview

| Field | Value |
|-------|-------|
| Priority | P1 |
| Status | Pending |
| Effort | 2h |

**Simplified for PoC:**
- Single Kafka broker, single Cassandra node
- No replication factor concerns
- All data lost on restart is fine for demo

## Requirements

### Services (docker-compose.yml)

| Service | Image | Ports |
|---------|-------|-------|
| Zookeeper | confluentinc/cp-zookeeper:7.6.0 | 2181 |
| Kafka | confluentinc/cp-kafka:7.6.0 | 9092 |
| Cassandra | cassandra:4.1 | 9042 |

### Kafka Topics (3 topics)

| Topic | Partitions | Replication | Purpose |
|-------|-----------|-------------|---------|
| `raw-location-events` | 1 | 1 | GPX lat/lon from simulator |
| `processed-updates` | 1 | 1 | Enriched with speed, ETA, distance |
| `alerts` | 1 | 1 | Speed violations + proximity alerts |

Create topics:
```bash
docker exec kafka kafka-topics \
  --create --topic raw-location-events \
  --bootstrap-server localhost:9092 --partitions 1 --replication-factor 1

docker exec kafka kafka-topics \
  --create --topic processed-updates \
  --bootstrap-server localhost:9092 --partitions 1 --replication-factor 1

docker exec kafka kafka-topics \
  --create --topic alerts \
  --bootstrap-server localhost:9092 --partitions 1 --replication-factor 1
```

### Cassandra Tables (5 tables — full schema from SPEC.md §5.6)

```sql
-- Keyspace
CREATE KEYSPACE IF NOT EXISTS delivery_tracking
WITH REPLICATION = {'class': 'SimpleStrategy', 'replication_factor': 1};

-- [Table 1] Orders
-- Purpose: Track order lifecycle, assign drivers, store destination coordinates
-- Query: SELECT * FROM orders WHERE order_id = ?
CREATE TABLE IF NOT EXISTS orders (
    order_id UUID PRIMARY KEY,
    customer_id UUID,
    driver_id UUID,
    restaurant_location TEXT,      -- "lat,lng"
    delivery_location TEXT,         -- "lat,lng"
    status TEXT,                  -- PENDING, ACCEPTED, PICKING_UP, IN_TRANSIT, ARRIVING, DELIVERED
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);

-- [Table 2] Trip Locations (time-series)
-- Purpose: Store full GPS trace for trip playback
-- Query: SELECT * FROM trip_locations WHERE trip_id = ? ORDER BY timestamp ASC
-- Query: SELECT * FROM trip_locations WHERE trip_id = ? LIMIT 1 (latest location)
CREATE TABLE IF NOT EXISTS trip_locations (
    trip_id UUID,
    timestamp TIMESTAMP,
    driver_id UUID,
    order_id UUID,
    latitude DOUBLE,
    longitude DOUBLE,
    speed DOUBLE,
    heading DOUBLE,
    accuracy DOUBLE,
    PRIMARY KEY (trip_id, timestamp)
) WITH CLUSTERING ORDER BY (timestamp DESC);

-- [Table 3] Trip Metadata (aggregate summary)
-- Purpose: Aggregate trip stats for billing and analytics
-- Query: SELECT * FROM trip_metadata WHERE trip_id = ?
CREATE TABLE IF NOT EXISTS trip_metadata (
    trip_id UUID PRIMARY KEY,
    driver_id UUID,
    order_id UUID,
    start_time TIMESTAMP,
    end_time TIMESTAMP,
    start_location TEXT,
    destination TEXT,
    total_distance DOUBLE,         -- km (calculated from trip_locations)
    total_duration INT,           -- seconds
    average_speed DOUBLE,         -- km/h
    max_speed DOUBLE,
    speeding_violations INT,
    trip_cost DECIMAL,
    status TEXT                   -- ACTIVE, COMPLETED, CANCELLED
);

-- [Table 4] Driver Analytics (weekly aggregation)
-- Purpose: Weekly performance reports for fleet management
-- Query: SELECT * FROM driver_analytics WHERE driver_id = ? AND week_start_date >= '2024-01-01'
-- Aggregation: SUM(total_distance), AVG(average_speed), SUM(speeding_violations) from trip_metadata
CREATE TABLE IF NOT EXISTS driver_analytics (
    driver_id UUID,
    week_start_date DATE,          -- e.g., 2024-01-29 (Monday)
    total_trips INT,
    total_distance DOUBLE,         -- km
    total_duration INT,           -- seconds
    average_speed DOUBLE,          -- km/h
    speeding_violations INT,
    idle_time INT,                -- seconds (time between trips)
    PRIMARY KEY (driver_id, week_start_date)
) WITH CLUSTERING ORDER BY (week_start_date DESC);

-- [Table 5] Alerts (audit trail)
-- Purpose: Audit trail of safety violations and proximity notifications
-- Query: SELECT * FROM alerts WHERE driver_id = ? AND timestamp >= ?
-- Supports: Speed > 60 km/h violations, distance < 500m proximity alerts
CREATE TABLE IF NOT EXISTS alerts (
    alert_id UUID,
    driver_id UUID,
    trip_id UUID,
    timestamp TIMESTAMP,
    alert_type TEXT,               -- SPEEDING, PROXIMITY, GEOFENCE
    severity TEXT,                 -- HIGH, MEDIUM, LOW
    message TEXT,
    metadata MAP<TEXT, TEXT>,      -- {"current_speed": "75", "limit": "60", "distance_m": "480"}
    PRIMARY KEY (driver_id, timestamp, alert_id)
) WITH CLUSTERING ORDER BY (timestamp DESC);
```

## Implementation Steps

1. Create `docker-compose.yml` with zookeeper, kafka, cassandra
2. Create `scripts/init-cql.cql` with all 5 tables
3. Create `scripts/start.sh`:
   ```bash
   docker-compose up -d
   sleep 20
   docker exec -i cassandra cqlsh < scripts/init-cql.cql
   ```
4. Create 3 Kafka topics manually or via kafka-topics CLI

## Todo List

- [ ] docker-compose.yml (zookeeper + kafka + cassandra)
- [ ] init-cql.cql with 5 tables
- [ ] start.sh script
- [ ] Create 3 Kafka topics
- [ ] Verify all services start and topics exist

## Success Criteria

- `docker-compose ps` shows all 3 services running
- `docker exec cassandra cqlsh -e "DESCRIBE TABLES;"` shows 5 tables: orders, trip_locations, trip_metadata, driver_analytics, alerts
- `docker exec kafka kafka-topics --list --bootstrap localhost:9092` shows all 3 topics
