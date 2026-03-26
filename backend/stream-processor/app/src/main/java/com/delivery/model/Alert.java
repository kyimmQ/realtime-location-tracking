package com.delivery.model;

import java.time.Instant;
import java.util.Map;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.annotation.JsonFormat;

public class Alert {
    @JsonProperty("alert_id")
    private String alertId;

    @JsonProperty("driver_id")
    private String driverId;

    @JsonProperty("trip_id")
    private String tripId;

    @JsonProperty("timestamp")
    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", timezone = "UTC")
    private Instant timestamp;

    @JsonProperty("alert_type")
    private String alertType;

    @JsonProperty("severity")
    private String severity;

    @JsonProperty("message")
    private String message;

    @JsonProperty("metadata")
    private Map<String, String> metadata;

    public Alert() {}

    public Alert(String alertId, String driverId, String tripId, Instant timestamp,
                 String alertType, String severity, String message, Map<String, String> metadata) {
        this.alertId = alertId;
        this.driverId = driverId;
        this.tripId = tripId;
        this.timestamp = timestamp;
        this.alertType = alertType;
        this.severity = severity;
        this.message = message;
        this.metadata = metadata;
    }

    public String getAlertId() { return alertId; }
    public void setAlertId(String alertId) { this.alertId = alertId; }

    public String getDriverId() { return driverId; }
    public void setDriverId(String driverId) { this.driverId = driverId; }

    public String getTripId() { return tripId; }
    public void setTripId(String tripId) { this.tripId = tripId; }

    public Instant getTimestamp() { return timestamp; }
    public void setTimestamp(Instant timestamp) { this.timestamp = timestamp; }

    public String getAlertType() { return alertType; }
    public void setAlertType(String alertType) { this.alertType = alertType; }

    public String getSeverity() { return severity; }
    public void setSeverity(String severity) { this.severity = severity; }

    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }

    public Map<String, String> getMetadata() { return metadata; }
    public void setMetadata(Map<String, String> metadata) { this.metadata = metadata; }
}