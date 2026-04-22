package com.delivery.model;

public class RouteProgressState {
    private int lastRouteIndex;
    private double distanceTraveledKm;
    private double totalRouteDistanceKm;

    public RouteProgressState() {}

    public RouteProgressState(int lastRouteIndex, double distanceTraveledKm, double totalRouteDistanceKm) {
        this.lastRouteIndex = lastRouteIndex;
        this.distanceTraveledKm = distanceTraveledKm;
        this.totalRouteDistanceKm = totalRouteDistanceKm;
    }

    public int getLastRouteIndex() {
        return lastRouteIndex;
    }

    public void setLastRouteIndex(int lastRouteIndex) {
        this.lastRouteIndex = lastRouteIndex;
    }

    public double getDistanceTraveledKm() {
        return distanceTraveledKm;
    }

    public void setDistanceTraveledKm(double distanceTraveledKm) {
        this.distanceTraveledKm = distanceTraveledKm;
    }

    public double getTotalRouteDistanceKm() {
        return totalRouteDistanceKm;
    }

    public void setTotalRouteDistanceKm(double totalRouteDistanceKm) {
        this.totalRouteDistanceKm = totalRouteDistanceKm;
    }
}
