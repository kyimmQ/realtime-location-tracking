package com.delivery.util;

import com.delivery.model.Destination;

import java.util.ArrayList;
import java.util.List;

public class RouteDistance {
    private RouteDistance() {}

    public static class Progress {
        private final int routeIndex;
        private final double totalDistanceKm;
        private final double distanceTraveledKm;
        private final double distanceRemainingKm;

        public Progress(int routeIndex, double totalDistanceKm, double distanceTraveledKm, double distanceRemainingKm) {
            this.routeIndex = routeIndex;
            this.totalDistanceKm = totalDistanceKm;
            this.distanceTraveledKm = distanceTraveledKm;
            this.distanceRemainingKm = distanceRemainingKm;
        }

        public int getRouteIndex() {
            return routeIndex;
        }

        public double getTotalDistanceKm() {
            return totalDistanceKm;
        }

        public double getDistanceTraveledKm() {
            return distanceTraveledKm;
        }

        public double getDistanceRemainingKm() {
            return distanceRemainingKm;
        }
    }

    public static double remainingDistanceKm(double currentLat, double currentLon, Destination destination) {
        if (destination == null) {
            return 0.0;
        }

        List<double[]> routePoints = normalizeRoutePoints(destination.getRoutePoints());
        if (routePoints.size() < 2) {
            return Haversine.haversine(currentLat, currentLon, destination.getLatitude(), destination.getLongitude());
        }

        int closestIndex = findClosestPointIndex(currentLat, currentLon, routePoints);
        if (closestIndex < 0) {
            return Haversine.haversine(currentLat, currentLon, destination.getLatitude(), destination.getLongitude());
        }

        double remainingKm = Haversine.haversine(
                currentLat, currentLon,
                routePoints.get(closestIndex)[0], routePoints.get(closestIndex)[1]
        );

        for (int i = closestIndex; i < routePoints.size() - 1; i++) {
            double[] from = routePoints.get(i);
            double[] to = routePoints.get(i + 1);
            remainingKm += Haversine.haversine(from[0], from[1], to[0], to[1]);
        }

        return remainingKm;
    }

    public static Progress progressKm(double currentLat, double currentLon, Destination destination, int minRouteIndex) {
        if (destination == null) {
            return new Progress(0, 0.0, 0.0, 0.0);
        }

        List<double[]> routePoints = normalizeRoutePoints(destination.getRoutePoints());
        if (routePoints.size() < 2) {
            double straightLine = Haversine.haversine(currentLat, currentLon, destination.getLatitude(), destination.getLongitude());
            return new Progress(0, straightLine, 0.0, straightLine);
        }

        int closestIndex = findClosestPointIndex(currentLat, currentLon, routePoints);
        if (closestIndex < 0) {
            double straightLine = Haversine.haversine(currentLat, currentLon, destination.getLatitude(), destination.getLongitude());
            return new Progress(0, straightLine, 0.0, straightLine);
        }

        int clampedMinIndex = Math.max(0, Math.min(minRouteIndex, routePoints.size() - 1));
        int routeIndex = Math.max(clampedMinIndex, closestIndex);

        double totalDistanceKm = 0.0;
        for (int i = 0; i < routePoints.size() - 1; i++) {
            double[] from = routePoints.get(i);
            double[] to = routePoints.get(i + 1);
            totalDistanceKm += Haversine.haversine(from[0], from[1], to[0], to[1]);
        }

        double traveledKm = 0.0;
        for (int i = 0; i < routeIndex; i++) {
            double[] from = routePoints.get(i);
            double[] to = routePoints.get(i + 1);
            traveledKm += Haversine.haversine(from[0], from[1], to[0], to[1]);
        }

        double distanceToIndexedPointKm = Haversine.haversine(
                currentLat, currentLon,
                routePoints.get(routeIndex)[0], routePoints.get(routeIndex)[1]
        );
        traveledKm = Math.min(totalDistanceKm, traveledKm + distanceToIndexedPointKm);

        double remainingKm = Math.max(0.0, totalDistanceKm - traveledKm);
        return new Progress(routeIndex, totalDistanceKm, traveledKm, remainingKm);
    }

    private static int findClosestPointIndex(double lat, double lon, List<double[]> routePoints) {
        int closestIndex = -1;
        double minDistance = Double.MAX_VALUE;

        for (int i = 0; i < routePoints.size(); i++) {
            double[] point = routePoints.get(i);
            double distance = Haversine.haversine(lat, lon, point[0], point[1]);
            if (distance < minDistance) {
                minDistance = distance;
                closestIndex = i;
            }
        }

        return closestIndex;
    }

    private static List<double[]> normalizeRoutePoints(List<List<Double>> rawRoutePoints) {
        List<double[]> normalized = new ArrayList<>();
        if (rawRoutePoints == null) {
            return normalized;
        }

        for (List<Double> point : rawRoutePoints) {
            if (point == null || point.size() < 2 || point.get(0) == null || point.get(1) == null) {
                continue;
            }
            normalized.add(new double[]{point.get(0), point.get(1)});
        }

        return normalized;
    }
}
