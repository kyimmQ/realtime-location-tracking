package com.delivery.model;

import java.util.Date;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.annotation.JsonFormat;

public class LocationEvent {
    @JsonProperty("driver_id")
    private String driverId;

    @JsonProperty("trip_id")
    private String tripId;

    @JsonProperty("order_id")
    private String orderId;

    @JsonProperty("timestamp")
    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd'T'HH:mm:ss.SSSX")
    private Date timestamp;

    @JsonProperty("latitude")
    private double latitude;

    @JsonProperty("longitude")
    private double longitude;

    @JsonProperty("speed")
    private double speed;

    @JsonProperty("heading")
    private double heading;

    @JsonProperty("altitude")
    private double altitude;

    @JsonProperty("accuracy")
    private double accuracy;

    public LocationEvent() {}

    public LocationEvent(String driverId, String tripId, String orderId, Date timestamp,
                         double latitude, double longitude, double speed, double heading,
                         double altitude, double accuracy) {
        this.driverId = driverId;
        this.tripId = tripId;
        this.orderId = orderId;
        this.timestamp = timestamp;
        this.latitude = latitude;
        this.longitude = longitude;
        this.speed = speed;
        this.heading = heading;
        this.altitude = altitude;
        this.accuracy = accuracy;
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

    public double getLatitude() { return latitude; }
    public void setLatitude(double latitude) { this.latitude = latitude; }

    public double getLongitude() { return longitude; }
    public void setLongitude(double longitude) { this.longitude = longitude; }

    public double getSpeed() { return speed; }
    public void setSpeed(double speed) { this.speed = speed; }

    public double getHeading() { return heading; }
    public void setHeading(double heading) { this.heading = heading; }

    public double getAltitude() { return altitude; }
    public void setAltitude(double altitude) { this.altitude = altitude; }

    public double getAccuracy() { return accuracy; }
    public void setAccuracy(double accuracy) { this.accuracy = accuracy; }
}
