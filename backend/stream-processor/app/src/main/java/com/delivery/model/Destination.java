package com.delivery.model;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;

public class Destination {
    @JsonProperty("order_id")
    private String orderId;

    @JsonProperty("driver_id")
    private String driverId;

    @JsonProperty("latitude")
    private double latitude;

    @JsonProperty("longitude")
    private double longitude;

    @JsonProperty("route_points")
    private List<List<Double>> routePoints;

    public Destination() {}

    public Destination(String orderId, String driverId, double latitude, double longitude) {
        this.orderId = orderId;
        this.driverId = driverId;
        this.latitude = latitude;
        this.longitude = longitude;
    }

    public Destination(String orderId, String driverId, double latitude, double longitude, List<List<Double>> routePoints) {
        this(orderId, driverId, latitude, longitude);
        this.routePoints = routePoints;
    }

    public String getOrderId() { return orderId; }
    public void setOrderId(String orderId) { this.orderId = orderId; }

    public String getDriverId() { return driverId; }
    public void setDriverId(String driverId) { this.driverId = driverId; }

    public double getLatitude() { return latitude; }
    public void setLatitude(double latitude) { this.latitude = latitude; }

    public double getLongitude() { return longitude; }
    public void setLongitude(double longitude) { this.longitude = longitude; }

    public List<List<Double>> getRoutePoints() { return routePoints; }
    public void setRoutePoints(List<List<Double>> routePoints) { this.routePoints = routePoints; }
}
