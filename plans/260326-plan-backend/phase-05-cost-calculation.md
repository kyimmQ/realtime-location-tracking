---
title: "Phase 5: Cost Calculation Service"
description: "Post-trip cost calculation: haversine sum from trip_locations, apply pricing formula, write to trip_metadata"
status: pending
priority: P1
effort: 2h
branch: main
tags: [backend, golang, cassandra]
created: 2026-03-26
---

# Phase 5: Cost Calculation Service

## Context Links

- Parent: [plan.md](./plan.md)
- Depends on: [Phase 1](./phase-01-infrastructure.md), [Phase 4](./phase-04-serving-service.md)
- Spec: `SPECIFICATION.md` (Requirement 7: Automated Delivery Cost Calculation)

## Overview

| Field | Value |
|-------|-------|
| Priority | P1 |
| Status | Pending |
| Effort | 2h |

After driver marks order as DELIVERED, calculate trip cost using stored GPS points.

## Pricing Formula

```
cost = base_fare + (distance_rate × total_distance) + (time_rate × total_duration)

Example:
  cost = $3.00 + ($0.50/km × 8.3 km) + ($0.10/min × 22 min)
       = $3.00 + $4.15 + $2.20
       = $9.35
```

## Implementation

### Trigger: PUT /api/orders/:id/status → "DELIVERED"

When order status changes to `DELIVERED`:
1. Look up `trip_id` for this order
2. Query all GPS points from `trip_locations` WHERE `trip_id = ? ORDER BY timestamp ASC`
3. Calculate:
   - `total_distance` = SUM(haversine between consecutive points)
   - `total_duration` = MAX(timestamp) - MIN(timestamp) in seconds
   - `average_speed` = total_distance / (total_duration / 3600) km/h
   - `max_speed` = MAX(speed) from all points
   - `speeding_violations` = COUNT of points where speed > 60
4. Apply pricing formula
5. UPDATE `trip_metadata` with all values + `status = 'COMPLETED'`

### Haversine Sum

```go
func CalculateTripDistance(points []TripPoint) double {
    totalKm := 0.0
    for i := 1; i < len(points); i++ {
        dist := haversine(
            points[i-1].Latitude, points[i-1].Longitude,
            points[i].Latitude,   points[i].Longitude,
        )
        totalKm += dist
    }
    return totalKm
}
```

### Update Trip Metadata

```go
func (c *Client) CompleteTrip(tripID string, points []TripPoint) error {
    if len(points) == 0 {
        return errors.New("no GPS points for trip")
    }

    startTime := points[0].Timestamp
    endTime := points[len(points)-1].Timestamp
    durationSec := int(endTime.Sub(startTime).Seconds())
    totalDistance := CalculateTripDistance(points)

    var maxSpeed, totalSpeed double
    speedingViolations := 0
    for _, p := range points {
        if p.Speed > maxSpeed {
            maxSpeed = p.Speed
        }
        if p.Speed > 60 {
            speedingViolations++
        }
        totalSpeed += p.Speed
    }
    avgSpeed := totalSpeed / float64(len(points))

    // Pricing formula
    const baseFare = 3.00
    const distanceRate = 0.50  // per km
    const timeRate = 0.10      // per minute
    durationMin := float64(durationSec) / 60.0
    tripCost := baseFare + (distanceRate * totalDistance) + (timeRate * durationMin)
    tripCost = math.Round(tripCost*100) / 100 // round to 2dp

    query := `UPDATE trip_metadata SET
        end_time = ?,
        total_distance = ?,
        total_duration = ?,
        average_speed = ?,
        max_speed = ?,
        speeding_violations = ?,
        trip_cost = ?,
        status = 'COMPLETED'
        WHERE trip_id = ?`

    return c.session.Query(query,
        endTime, totalDistance, durationSec, avgSpeed,
        maxSpeed, speedingViolations, tripCost, tripID,
    ).Exec()
}
```

## Flow

```
Driver app → PUT /api/orders/:id/status "DELIVERED"
    ↓
Serving service → CompleteTrip(tripID)
    ↓
Cassandra: UPDATE trip_metadata (trip_cost, status=COMPLETED)
    ↓
Customer: sees "Delivery Complete! Trip Cost: $9.35"
```

## Todo List

- [ ] Implement CompleteTrip in Cassandra client
- [ ] Wire to order status handler (DELIVERED trigger)
- [ ] Calculate haversine sum from trip_locations
- [ ] Update trip_metadata with all stats
- [ ] Test end-to-end: simulate full trip, mark DELIVERED, verify cost

## Success Criteria

- After marking order as DELIVERED, `trip_metadata` has `total_distance`, `total_duration`, `trip_cost`
- `trip_cost = 3.00 + (0.50 × distance_km) + (0.10 × duration_min)`
- speeding_violations count matches expected from GPX data
