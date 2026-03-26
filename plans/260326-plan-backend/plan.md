---
title: "Backend Implementation Plan"
description: "Implement backend: Golang GPX→Kafka, Java Kafka Streams (ETA/speed/distance calc), Golang WebSocket serving, full Cassandra storage"
status: pending
priority: P1
effort: 16h
branch: main
tags: [backend, golang, java, kafka, cassandra]
created: 2026-03-26
---

# Backend Implementation Plan (Academic PoC)

## Overview

Single GPX file, one driver, one-trip demo flow. No multi-driver simulation, no scaling concerns. **Full business requirements restored** — all 8 requirements from SPEC.md are implemented.

## Business Requirements (8 Total)

### Kafka Streams (Requirements 1-4)

| # | Requirement | Description |
|---|-------------|-------------|
| 1 | Real-Time Location Tracking | Filter invalid coords, deduplicate, pass through to `processed-updates` |
| 2 | Dynamic ETA Calculation | Windowed aggregation (30s tumbling), haversine distance, moving average speed → ETA |
| 3 | Speed Limit Monitoring | Stateful velocity calculation; publish alert when speed > 60 km/h → `alerts` topic |
| 4 | Proximity Alerts (Geofencing) | Stream-table join with destination KTable; trigger alert when distance < 500m → `alerts` topic |

### Cassandra (Requirements 5-8)

| # | Requirement | Description |
|---|-------------|-------------|
| 5 | Trip History & Route Playback | `trip_locations` partitioned by `trip_id`, clustered by `timestamp` |
| 6 | Driver Performance Analytics | `driver_analytics` partitioned by `driver_id`, weekly aggregations |
| 7 | Automated Cost Calculation | `trip_metadata`: `cost = base_fare + (distance_rate × distance) + (time_rate × duration)` |
| 8 | Service Area Heatmaps | Query `trip_locations` by time range, aggregate by geo-hash |

## Phases

| # | Phase | Status | Effort | Link |
|---|-------|--------|--------|------|
| 1 | Infrastructure | Pending | 2h | [phase-01](./phase-01-infrastructure.md) |
| 2 | Ingestion Service | Pending | 3h | [phase-02-ingestion-service.md) |
| 3 | Kafka Streams | Pending | 5h | [phase-03-kafka-streams.md) |
| 4 | Serving Service | Pending | 4h | [phase-04-serving-service.md) |
| 5 | Cost Calculation | Pending | 2h | [phase-05-cost-calculation.md) |

## Tech Stack (Unchanged from Spec)

| Component | Technology |
|-----------|------------|
| Ingestion | Golang + `segmentio/kafka-go` |
| Processing | Java + Kafka Streams DSL |
| Storage | Apache Cassandra |
| WebSocket | `gorilla/websocket` |
| API | Gin |

## Research

- [Research Report](./research/researcher-01-backend-report.md)
