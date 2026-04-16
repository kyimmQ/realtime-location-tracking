# Codebase Summary

**Version:** 2.0.0
**Last Updated:** 2026-04-16

## 1. Project Overview

Real-Time Delivery Tracking System — a data-intensive, event-driven application simulating food delivery/ride-hailing (Uber Eats-style). Course project for CO5173 Data Engineering, Semester 2 2025-2026.

**Three user roles:** Customer (place orders, track driver), Driver (accept orders, GPS playback via GPX), Admin (fleet analytics, alerts, heatmaps).

## 2. Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Ingestion/Serving API | **Go** (Gin framework) | REST API, WebSocket, Kafka producer, GPX simulator |
| Stream Processing | **Java** (Kafka Streams) | Speed calculation, alert generation, ETA enrichment |
| Time-Series Store | **Apache Cassandra** | Trip locations, alerts, driver analytics, trip metadata |
| Relational Store | **PostgreSQL** | Users, auth, orders, driver profiles |
| Message Broker | **Apache Kafka** | Event streaming between services |
| Frontend | **React** + TypeScript + Vite + Tailwind | Map-based UI with Leaflet, WebSocket real-time |

## 3. Directory Structure

```
/
├── backend/
│   ├── docker-compose.yml       # Kafka, Cassandra, PostgreSQL, stream-processor
│   ├── scripts/
│   │   ├── init-cql.cql         # Cassandra schema (5 tables)
│   │   ├── init-postgres.sql    # PostgreSQL schema (3 tables)
│   │   ├── seed-postgres.sql    # Seed data
│   │   └── start.sh             # Startup script
│   ├── src/                     # Go API service
│   │   ├── cmd/
│   │   │   ├── api/main.go      # API server entry point
│   │   │   └── simulator/main.go # GPX simulator entry point
│   │   ├── go.mod / go.sum      # Go module (gin, gocql, pgx, kafka-go, gorilla/websocket)
│   │   └── internal/
│   │       ├── api/
│   │       │   ├── router.go            # Gin routes + WebSocket handler
│   │       │   ├── handlers/            # auth, orders, trips, drivers, admin
│   │       │   └── middleware/auth.go   # JWT auth middleware
│   │       ├── auth/                    # JWT + bcrypt password handling
│   │       ├── cassandra/               # Cassandra client (drivers, heatmap, orders queries)
│   │       ├── gpx/                     # GPX file parser + service
│   │       ├── postgres/                # PostgreSQL client (users, orders, driver profiles)
│   │       ├── simulator/trigger.go     # GPX playback trigger
│   │       └── websocket/               # Hub, Kafka consumer, alert consumer
│   └── stream-processor/       # Java Kafka Streams app
│       ├── app/src/main/java/com/delivery/
│       │   ├── Main.java
│       │   ├── model/           # LocationEvent, EnrichedLocation, Alert, SpeedAccumulator
│       │   ├── processor/       # SpeedAlertProcessor (stateful, Haversine distance)
│       │   ├── serde/           # JSON serializer/deserializer
│       │   └── util/            # Haversine distance formula
│       ├── build.gradle.kts
│       └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── App.tsx              # Router: login, user/driver/admin dashboards, tracking
│   │   ├── main.tsx             # Entry point
│   │   ├── index.css            # Global styles + Tailwind
│   │   ├── pages/
│   │   │   ├── LoginPage.tsx    # Role-based login (user/driver/admin)
│   │   │   ├── user/DashboardPage.tsx    # Customer: create order, track
│   │   │   ├── driver/DashboardPage.tsx  # Driver: accept orders, status updates
│   │   │   └── admin/DashboardPage.tsx   # Admin: analytics overview
│   │   ├── features/
│   │   │   ├── admin/           # AdminPage, AlertFeed, DriverAnalytics, ServiceHeatmap, TripPlayback, adminStore
│   │   │   ├── driver/          # DriverPage, driverStore
│   │   │   └── tracking/        # TrackingPage, TrackingMap (Leaflet), trackingStore, alertStore
│   │   ├── shared/
│   │   │   ├── context/AuthContext.tsx   # Auth state provider
│   │   │   ├── hooks/useAuth.ts, useWebSocket.ts
│   │   │   └── types/index.ts  # TypeScript interfaces
│   │   └── components/ui/      # Badge, Button, MetricCard
│   ├── tailwind.config.js
│   └── package.json
├── docs/                        # Project documentation
├── plans/                       # Implementation plans (backend + frontend phases)
├── gpxs/                        # GPX track files for simulation
└── SPECIFICATION.md             # Project specification
```

## 4. Data Flow

```
GPX Simulator → Kafka (raw-location-events)
                     ↓
              Kafka Streams (SpeedAlertProcessor)
              - Calculates speed via Haversine distance
              - Enriches location with speed data
              - Generates speeding/proximity alerts
                     ↓
        ┌────────────┴────────────┐
        ↓                         ↓
Kafka (processed-updates)   Kafka (alerts)
        ↓                         ↓
  Go WebSocket Hub          Go WebSocket Hub
  (location broadcast)      (alert broadcast)
        ↓                         ↓
  React + Leaflet           React AlertFeed
  (real-time map)            (live alerts)
        ↓
  Cassandra (trip_locations, trip_metadata, alerts, driver_analytics)
  PostgreSQL (orders status updates)
```

## 5. API Endpoints

### Public
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/register` | Register user |
| POST | `/api/auth/login` | Login |
| POST | `/api/auth/refresh` | Refresh JWT |
| GET | `/ws/tracking` | WebSocket connection |

### Protected (JWT required)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/auth/me` | Current user |
| POST | `/api/orders` | Create order (USER) |
| GET | `/api/orders` | List orders |
| GET | `/api/orders/:id` | Get order detail |
| PUT | `/api/orders/:id/status` | Update order status |
| GET | `/api/orders/:id/route` | Get order route points |
| GET | `/api/trips/:id` | Trip metadata |
| GET | `/api/trips/:id/route` | Trip route for playback |
| GET | `/api/drivers/:id/analytics` | Driver analytics (ADMIN/DRIVER) |
| GET | `/api/drivers/:id/alerts` | Driver alerts (ADMIN/DRIVER) |
| GET | `/api/drivers/:id/orders` | Driver orders (ADMIN/DRIVER) |
| GET | `/api/admin/heatmap` | Service heatmap (ADMIN) |

## 6. Database Schema

### Cassandra (5 tables)
- **orders** — order lifecycle (status, driver assignment, locations)
- **trip_locations** — time-series GPS trace (clustered by timestamp DESC)
- **trip_metadata** — aggregate trip stats (distance, duration, cost)
- **driver_analytics** — weekly driver performance aggregation
- **alerts** — audit trail (speeding, proximity, geofence violations)

### PostgreSQL (3 tables)
- **users** — auth (email, password_hash, role: USER/DRIVER/ADMIN)
- **driver_profiles** — driver info (license, vehicle, availability status)
- **orders** — operational order data (with route_points JSONB)

## 7. Infrastructure (Docker Compose)

- **Zookeeper** (2181) — Kafka coordination
- **Kafka** (9092) — message broker
- **Cassandra** (9042) — time-series store
- **PostgreSQL** (5432) — relational store
- **stream-processor** — Java Kafka Streams container

## 8. Current State

- **Phase:** Implementation largely complete
- **Backend:** Go API + Java stream processor operational
- **Frontend:** React app with all three dashboards (user, driver, admin)
- **Real-time:** WebSocket-based live tracking via Kafka consumer
- **Testing:** Unit tests for auth handlers, JWT, password, middleware
- **Uncommitted changes:** UI modifications to AdminPage, DriverPage, LoginPage, DashboardPage, CSS, tailwind config
