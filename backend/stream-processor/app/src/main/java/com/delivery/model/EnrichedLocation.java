package com.delivery.model;

import java.util.Date;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.annotation.JsonFormat;

public class EnrichedLocation {

    @JsonProperty("driver_id")
    private String driverId;

    @JsonProperty("trip_id")
    private String tripId;

    @JsonProperty("order_id")
    private String orderId;

    @JsonProperty("timestamp")
    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd'T'HH:mm:ss.SSSX")
    private Date timestamp;

    public static class Location {
        @JsonProperty("latitude")
        private double latitude;

        @JsonProperty("longitude")
        private double longitude;

        public Location() {}
        public Location(double latitude, double longitude) {
            this.latitude = latitude;
            this.longitude = longitude;
        }

        public double getLatitude() { return latitude; }
        public void setLatitude(double latitude) { this.latitude = latitude; }

        public double getLongitude() { return longitude; }
        public void setLongitude(double longitude) { this.longitude = longitude; }
    }

    @JsonProperty("location")
    private Location location;

    @JsonProperty("speed")
    private double speed;

    @JsonProperty("heading")
    private double heading;

    @JsonProperty("eta_seconds")
    private Integer etaSeconds;

    @JsonProperty("distance_to_destination")
    private double distanceToDestination;

    @JsonProperty("is_speeding")
    private boolean speeding;

    public EnrichedLocation() {}

    public EnrichedLocation(LocationEvent event, double calculatedSpeedKmh) {
        this.driverId = event.getDriverId();
        this.tripId = event.getTripId();
        this.orderId = event.getOrderId();
        this.timestamp = event.getTimestamp();
        this.location = new Location(event.getLatitude(), event.getLongitude());
        this.speed = calculatedSpeedKmh;
        this.heading = event.getHeading();
        this.speeding = calculatedSpeedKmh > 60.0;
    }

    // Builder-like pattern for transformations
    public EnrichedLocation withDistanceAndEta(double distanceKm, int etaSec) {
        this.distanceToDestination = distanceKm;
        this.etaSeconds = etaSec;
        return this;
    }

    // Getters and Setters
    public String getDriverId() { return driverId; }
    public void setDriverId(String driverId) { this.driverId = driverId; }

    public String getTripId() { return tripId; }
    public void setTripId(String tripId) { this.tripId = tripId; }

    public String getOrderId() { return orderId; }
    public void setOrderId(String orderId) { this.orderId = orderId; }

    public Date getTimestamp() { return timestamp; }
    public void setTimestamp(Date timestamp) { this.timestamp = timestamp; }

    public Location getLocation() { return location; }
    public void setLocation(Location location) { this.location = location; }

    public double getSpeed() { return speed; }
    public void setSpeed(double speed) { this.speed = speed; }

    public double getHeading() { return heading; }
    public void setHeading(double heading) { this.heading = heading; }

    public Integer getEtaSeconds() { return etaSeconds; }
    public void setEtaSeconds(Integer etaSeconds) { this.etaSeconds = etaSeconds; }

    public double getDistanceToDestination() { return distanceToDestination; }
    public void setDistanceToDestination(double distanceToDestination) { this.distanceToDestination = distanceToDestination; }

    public boolean isSpeeding() { return speeding; }
    public void setSpeeding(boolean speeding) { this.speeding = speeding; }

    // Helpers
    public double getLatitude() { return location != null ? location.getLatitude() : 0.0; }
    public double getLongitude() { return location != null ? location.getLongitude() : 0.0; }
}