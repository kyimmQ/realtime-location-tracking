---
title: "Phase 3: Java Kafka Streams Processor"
description: "Full Kafka Streams topology: filter → speed calc (stateful) → windowed avg → stream-table join → branch (alerts + processed)"
status: pending
priority: P1
effort: 5h
branch: main
tags: [backend, java, kafka-streams]
created: 2026-03-26
---

# Phase 3: Kafka Streams Processor

## Context Links

- Parent: [plan.md](./plan.md)
- Depends on: [Phase 1](./phase-01-infrastructure.md) (Kafka + all 3 topics running)
- Spec: `SPECIFICATION.md` (Kafka Streams Topology §5.5, Alert Schema §6.3)

## Overview

| Field | Value |
|-------|-------|
| Priority | P1 |
| Status | Pending |
| Effort | 5h |

This implements all 4 Kafka Streams business requirements:

1. **Location Tracking**: Filter invalid coordinates, deduplicate
2. **Speed Calculation**: Stateful processor (stores previous point in RocksDB)
3. **Dynamic ETA**: Windowed aggregation (30s tumbling) for moving average speed
4. **Proximity Alerts**: Stream-table join with destination KTable
5. **Speed Monitoring**: Branch → publish `alerts` topic when speed > 60 km/h

## Full Topology (from SPEC.md §5.5)

```
Input: raw-location-events
   │
   ▼
[1] Filter Invalid Coordinates
   │  (lat/lng bounds: -90≤lat≤90, -180≤lon≤180, accuracy ≤ 20m)
   ▼
[2] Stateful Speed Calculation
   │  (velocity = haversine(curr,prev) / time_delta × 3600, stores prev in RocksDB)
   ▼
[3] Windowed Aggregation (30-second tumbling window)
   │  (moving average speed over last 30s window)
   ▼
[4] Stream-Table Join with Destination (KTable)
   │  (destination from orders KTable; compute haversine distance)
   ▼
[5] Branch:
   ├─→ speed > 60 km/h?     → alerts topic (SPEEDING alert)
   ├─→ distance < 500m?      → alerts topic (PROXIMITY alert)
   └─→ valid location        → processed-updates topic
```

## Project Structure

```
stream-processor/
├── build.gradle.kts
├── src/main/java/com/delivery/
│   ├── Main.java                         # Topology builder + streams app
│   ├── SpeedAlertProcessor.java           # Requirement 3: Stateful speed + alert
│   ├── ETACalculator.java               # Requirement 2: Windowed avg speed + ETA
│   ├── DestinationSupplier.java          # KTable source: hardcoded dest for PoC
│   └── util/
│       └── Haversine.java               # Distance formula (shared)
├── src/test/java/com/delivery/
│   └── MainTest.java                     # TopologyTestDriver tests
└── config/
    └── streams.properties                 # Kafka Streams config
```

## Key Components

### [1] Filter Processor (Requirement 1)

```java
// Filter out invalid GPS coordinates
Predicate<String, LocationEvent> validCoordinates = (key, event) ->
    event.getLatitude() >= -90 && event.getLatitude() <= 90
    && event.getLongitude() >= -180 && event.getLongitude() <= 180
    && event.getAccuracy() <= 20.0;

stream.filter(validCoordinates)
```

### [2] Stateful Speed Calculator (Requirement 3)

Stores previous GPS point in RocksDB state store (`previous-location`).

```java
// state store: driver_id → previous LocationEvent
// On each new point:
//   distance = haversine(curr, prev)
//   time_delta = curr.timestamp - prev.timestamp
//   speed_kmh = (distance / time_delta) * 3600

public class SpeedAlertProcessor implements ProcessorSupplier<String, LocationEvent,
                                                              String, EnrichedLocation> {

    public static final String STATE_STORE = "previous-location";

    @Override
    public Processor<String, LocationEvent, String, EnrichedLocation> get() {
        return new Processor<>() {
            private ProcessorContext context;
            private StateStore stateStore;

            @Override
            public void init(ProcessorContext ctx) {
                this.context = ctx;
                this.stateStore = ctx.getStateStore(STATE_STORE);
            }

            @Override
            public void process(Record<String, LocationEvent> record) {
                LocationEvent curr = record.value();
                LocationEvent prev = (LocationEvent) stateStore.get(record.key());

                double speedKmh = 0.0;
                if (prev != null) {
                    double distKm = Haversine.haversine(
                        prev.getLatitude(), prev.getLongitude(),
                        curr.getLatitude(), curr.getLongitude()
                    );
                    double seconds = (curr.getTimestamp().getTime()
                                     - prev.getTimestamp().getTime()) / 1000.0;
                    speedKmh = seconds > 0 ? (distKm / seconds) * 3600 : 0.0;
                }

                EnrichedLocation enriched = new EnrichedLocation(curr, speedKmh,
                    false, 0.0); // isSpeeding, distanceToDestination

                // Store current as previous for next iteration
                stateStore.put(record.key(), curr);

                // Branch: if speeding → not sent to processed-updates directly
                context.forward(record.withValue(enriched));
            }
        };
    }
}
```

### [3] Windowed Aggregation for ETA (Requirement 2)

```java
// Tumbling window: 30-second windows, no grace period
TimeWindows.of(Duration.ofSeconds(30))

// Aggregate into SpeedAccumulator (holds sum + count)
stream
    .groupByKey()
    .windowedBy(TimeWindows.of(Duration.ofSeconds(30)).withGrace(Duration.ZERO))
    .aggregate(
        SpeedAccumulator::new,
        (key, value, aggregate) -> aggregate.add(value.getSpeedKmh()),
        Materialized.<String, SpeedAccumulator>as("speed-window-store")
            .withValueSerde(new SpeedAccumulatorSerde())
    )
    .mapValues(accumulator -> accumulator.getAverage())
    // Join back with original stream to attach avg speed to each event
```

### [4] Stream-Table Join for Destination (Requirement 4)

```java
// Destination KTable (hardcoded for PoC; in production would read from orders topic)
KTable<String, Destination> destinationTable = builder.table(
    "orders",
    Consumed.with(Serdes.String(), new DestinationSerde()),
    Materialized.as("destination-store")
);

// Stream-table join: enrich each location with distance to destination
locationStream
    .leftJoin(destinationTable,
        (location, dest) -> {
            double distKm = Haversine.haversine(
                location.getLatitude(), location.getLongitude(),
                dest.getLatitude(), dest.getLongitude()
            );
            return location.withDistanceKm(distKm);
        }
    )
```

### [5] Branch: Speed + Proximity Alerts

```java
// Split into 3 branches:
KStream<String, EnrichedLocation>[] branches = enrichedStream.branch(
    // Branch 0: SPEEDING (speed > 60)
    (key, value) -> value.getSpeedKmh() > 60.0,
    // Branch 1: PROXIMITY (distance < 0.5km)
    (key, value) -> value.getDistanceKm() < 0.5,
    // Branch 2: VALID (default)
    (key, value) -> true
);

// Branch 0 → transform to Alert → to("alerts")
branches[0]
    .map((key, loc) -> {
        Alert alert = new Alert(
            UUID.randomUUID().toString(),
            loc.getDriverId(),
            loc.getTripId(),
            Instant.now(),
            "SPEEDING",
            "HIGH",
            String.format("Speed limit exceeded: %.0f km/h in 60 km/h zone", loc.getSpeedKmh()),
            Map.of("current_speed", String.valueOf((int) loc.getSpeedKmh()),
                   "limit", "60",
                   "location", loc.getLatitude() + "," + loc.getLongitude())
        );
        return new KeyValue<>(key, alert);
    })
    .to("alerts", Produced.with(Serdes.String(), new AlertSerde()));

// Branch 1 → transform to PROXIMITY Alert → to("alerts")
branches[1]
    .map((key, loc) -> {
        Alert alert = new Alert(
            UUID.randomUUID().toString(),
            loc.getDriverId(),
            loc.getTripId(),
            Instant.now(),
            "PROXIMITY",
            "MEDIUM",
            String.format("Driver is %.0fm away from destination", loc.getDistanceKm() * 1000),
            Map.of("distance_m", String.valueOf((int)(loc.getDistanceKm() * 1000)),
                   "threshold_m", "500")
        );
        return new KeyValue<>(key, alert);
    })
    .to("alerts", Produced.with(Serdes.String(), new AlertSerde()));

// Branch 2 → to("processed-updates")
branches[2]
    .mapValues(loc -> /* serialized EnrichedLocation */)
    .to("processed-updates");
```

## Gradle Setup

```kotlin
// build.gradle.kts
plugins {
    id("com.github.johnrengelman.shadow") version "8.1.1"
    id("java")
}

group = "com.delivery"
version = "1.0.0"

repositories {
    mavenCentral()
}

dependencies {
    implementation("org.apache.kafka:kafka-streams:3.6.1")
    implementation("com.fasterxml.jackson.core:jackson-databind:2.16.1")
    implementation("com.fasterxml.jackson.datatype:jackson-datatype-jsr310:2.16.1")
    testImplementation("org.apache.kafka:kafka-streams:3.6.1:test")
    testImplementation("org.junit.jupiter:junit-jupiter:5.10.1")
}

application {
    mainClass.set("com.delivery.Main")
}

tasks.shadow {
    archiveClassifier.set("")
    archiveFileName.set("stream-processor.jar")
}
```

## CLI Usage

```bash
# Build
./gradlew shadowJar

# Run (Kafka broker address as argument)
java -jar build/libs/stream-processor.jar localhost:9092

# Verify processed-updates output
docker exec kafka kafka-console-consumer --topic processed-updates \
  --from-beginning --bootstrap-server localhost:9092

# Verify alerts output (try triggering speeding)
docker exec kafka kafka-console-consumer --topic alerts \
  --from-beginning --bootstrap-server localhost:9092
```

## TopologyTestDriver Tests

```java
@Test
void testSpeedCalculation() {
    try (TopologyTestDriver driver = new TopologyTestDriver(topology, props)) {
        TestInputTopic<String, LocationEvent> input =
            driver.createInputTopic("raw-location-events",
                Serdes.String().serializer(), new LocationEventSerde());
        TestOutputTopic<String, EnrichedLocation> output =
            driver.createOutputTopic("processed-updates",
                Serdes.String().deserializer(), new EnrichedLocationSerde());

        // Send two points 1 second apart
        Instant t1 = Instant.parse("2024-01-30T10:15:30Z");
        Instant t2 = Instant.parse("2024-01-30T10:15:31Z");

        input.pipeInput("D001", new LocationEvent("D001", "T001", t1, 10.762, 106.660, 0, 5));
        input.pipeInput("D001", new LocationEvent("D001", "T001", t2, 10.763, 106.661, 0, 5));

        // ~111m in 1 second ≈ 400 km/h (clearly speeding)
        EnrichedLocation result = output.readValue();
        assertTrue(result.getSpeedKmh() > 0);
    }
}

@Test
void testProximityAlert() {
    // When distance < 500m, alert should appear in alerts topic
}
```

## Todo List

- [ ] Create Gradle project with kafka-streams dependency
- [ ] Implement Haversine utility
- [ ] Implement SpeedAlertProcessor (stateful)
- [ ] Implement windowed aggregation for average speed
- [ ] Implement destination KTable + stream-table join
- [ ] Implement branching topology (speed → alerts, proximity → alerts, valid → processed)
- [ ] Implement serializers/deserializers (JSON)
- [ ] Write TopologyTestDriver tests
- [ ] Build and run JAR

## Success Criteria

- `./gradlew build` passes
- Running JAR consumes from `raw-location-events`
- `processed-updates` topic: messages with `speed`, `eta_seconds`, `distance_km`
- `alerts` topic: SPEEDING alert when GPX has fast segment (> 60 km/h)
- `alerts` topic: PROXIMITY alert when distance < 500m
- Speed calculation: ~0 at start, increases as driver moves
- ETA recalculates every 10 seconds based on 30s moving average
