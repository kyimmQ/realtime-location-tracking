package com.delivery;

import com.delivery.model.Alert;
import com.delivery.model.Destination;
import com.delivery.model.EnrichedLocation;
import com.delivery.model.LocationEvent;
import com.delivery.serde.JsonSerde;
import org.apache.kafka.common.serialization.Serdes;
import org.apache.kafka.streams.*;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.Date;
import java.util.Properties;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class MainTest {
    private TopologyTestDriver driver;
    private TestInputTopic<String, LocationEvent> inputTopic;
    private TestOutputTopic<String, EnrichedLocation> outputTopic;
    private TestOutputTopic<String, Alert> alertsTopic;
    private TestInputTopic<String, Destination> destinationTopic;

    @BeforeEach
    void setup() {
        Topology topology = Main.buildTopology();

        Properties props = new Properties();
        props.put(StreamsConfig.APPLICATION_ID_CONFIG, "test-stream-processor");
        props.put(StreamsConfig.BOOTSTRAP_SERVERS_CONFIG, "dummy:1234");
        props.put(StreamsConfig.DEFAULT_KEY_SERDE_CLASS_CONFIG, Serdes.String().getClass());

        driver = new TopologyTestDriver(topology, props);

        inputTopic = driver.createInputTopic(
                "raw-location-events",
                Serdes.String().serializer(),
                new JsonSerde<>(LocationEvent.class).serializer()
        );

        destinationTopic = driver.createInputTopic(
                "orders",
                Serdes.String().serializer(),
                new JsonSerde<>(Destination.class).serializer()
        );

        outputTopic = driver.createOutputTopic(
                "processed-updates",
                Serdes.String().deserializer(),
                new JsonSerde<>(EnrichedLocation.class).deserializer()
        );

        alertsTopic = driver.createOutputTopic(
                "alerts",
                Serdes.String().deserializer(),
                new JsonSerde<>(Alert.class).deserializer()
        );
    }

    @AfterEach
    void tearDown() {
        if (driver != null) {
            driver.close();
        }
    }

    @Test
    void testSpeedCalculationAndAlert() {
        Instant t1 = Instant.parse("2024-01-30T10:15:30Z");
        Instant t2 = Instant.parse("2024-01-30T10:15:31Z");

        // Send two points 1 second apart with a significant distance (~111m)
        inputTopic.pipeInput("D001", new LocationEvent(
                "D001", "T001", "O001", Date.from(t1), 10.762, 106.660, 0, 5, 0, 10
        ));
        inputTopic.pipeInput("D001", new LocationEvent(
                "D001", "T001", "O001", Date.from(t2), 10.763, 106.661, 0, 5, 0, 10
        ));

        // Both valid points should be forwarded to processed-updates, but the second one
        // should have its speed calculated, and should trigger an alert
        EnrichedLocation firstValid = outputTopic.readValue();
        assertNotNull(firstValid);
        assertEquals(0.0, firstValid.getSpeed());

        // The second event should trigger speeding alert (> 60 km/h)
        Alert alert = alertsTopic.readValue();
        assertNotNull(alert);
        assertEquals("SPEEDING", alert.getAlertType());
        assertEquals("HIGH", alert.getSeverity());

        double speedVal = Double.parseDouble(alert.getMetadata().get("current_speed"));
        assertTrue(speedVal > 60.0, "Expected speed > 60.0 but got: " + speedVal);
    }

    @Test
    void testProximityAlert() {
        // Mock a destination exactly at 10.763, 106.661
        destinationTopic.pipeInput("D002", new Destination(10.763, 106.661));

        Instant t1 = Instant.parse("2024-01-30T10:15:30Z");

        // Point very close to destination (< 500m)
        inputTopic.pipeInput("D002", new LocationEvent(
                "D002", "T002", "O002", Date.from(t1), 10.76301, 106.66101, 10, 5, 0, 10
        ));

        // Note: The KStream/KTable join will enrich the location with distance.
        // As it falls within proximity (0 < dist < 0.5), it should trigger a PROXIMITY alert.
        Alert alert = alertsTopic.readValue();
        assertNotNull(alert);
        assertEquals("PROXIMITY", alert.getAlertType());
    }
}
