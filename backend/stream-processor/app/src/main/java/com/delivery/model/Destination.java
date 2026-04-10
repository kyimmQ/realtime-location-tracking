package com.delivery.model;

import com.fasterxml.jackson.annotation.JsonProperty;

public class Destination {
    @JsonProperty("order_id")
    private String orderId;

    @JsonProperty("driver_id")
    private String driverId;

    @JsonProperty("latitude")
    private double latitude;

    @JsonProperty("longitude")
    private double longitude;

    public Destination() {}

    public Destination(String orderId, String driverId, double latitude, double longitude) {
        this.orderId = orderId;
        this.driverId = driverId;
        this.latitude = latitude;
        this.longitude = longitude;
    }

    public String getOrderId() { return orderId; }
    public void setOrderId(String orderId) { this.orderId = orderId; }

    public String getDriverId() { return driverId; }
    public void setDriverId(String driverId) { this.driverId = driverId; }

    public double getLatitude() { return latitude; }
    public void setLatitude(double latitude) { this.latitude = latitude; }

    public double getLongitude() { return longitude; }
    public void setLongitude(double longitude) { this.longitude = longitude; }
}