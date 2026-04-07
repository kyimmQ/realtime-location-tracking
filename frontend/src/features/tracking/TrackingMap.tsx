import { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useTrackingStore } from './trackingStore';

// IMPORTANT: Use refs for marker, NOT React state
// This prevents DOM recreation on every position update

const driverIcon = L.icon({
  iconUrl: '/driver.svg', // SVG in public/
  iconSize: [40, 40],
  iconAnchor: [20, 20],
});

const destIcon = L.icon({
  iconUrl: '/dest.svg',
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

// Fixed destination for PoC (must match Kafka Streams destination)
const DEST_LAT = 10.7455190;
const DEST_LON = 106.6859480;
const DEFAULT_DEST: [number, number] = [DEST_LAT, DEST_LON];

// Destination = last route point (if available) or default
function getDest(routePoints: [number, number][]): [number, number] {
  return routePoints.length > 0 ? routePoints[routePoints.length - 1] : DEFAULT_DEST;
}

export function TrackingMap() {
  const driverMarkerRef = useRef<L.Marker>(null);
  const { driverPosition, traveledPath, routePoints } = useTrackingStore();

  // Update marker position imperatively (NOT via React state)
  useEffect(() => {
    if (driverMarkerRef.current && driverPosition) {
      driverMarkerRef.current.setLatLng([driverPosition.lat, driverPosition.lng]);
    }
  }, [driverPosition]);

  // Initial map center = first known position, first route point, or default
  const mapCenter: [number, number] = driverPosition
    ? [driverPosition.lat, driverPosition.lng]
    : routePoints.length > 0
    ? routePoints[0]
    : [10.7467950, 106.6841460];

  return (
    <MapContainer center={mapCenter} zoom={14} className="h-[500px] w-full rounded-lg">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {/* Destination marker */}
      <Marker position={getDest(routePoints)} icon={destIcon}>
        <Popup>Destination</Popup>
      </Marker>

      {/* Restaurant (start) marker */}
      {routePoints.length > 0 && (
        <Marker
          position={routePoints[0]}
          icon={L.icon({
            iconUrl: '/restaurant.svg',
            iconSize: [24, 24],
            iconAnchor: [12, 12],
          })}
        >
          <Popup>Restaurant</Popup>
        </Marker>
      )}

      {/* Driver marker - created once, moved via ref */}
      <Marker ref={driverMarkerRef} icon={driverIcon} position={mapCenter}>
        <Popup>Driver</Popup>
      </Marker>

      {/* Full route polyline (planned path from GPX) */}
      {routePoints.length > 1 && (
        <Polyline
          positions={routePoints}
          color="#94a3b8"
          weight={3}
          opacity={0.6}
          dashArray="8, 8"
        />
      )}

      {/* Traveled path polyline */}
      {traveledPath.length > 1 && (
        <Polyline
          positions={traveledPath}
          color="#3b82f6"
          weight={4}
          opacity={0.8}
        />
      )}
    </MapContainer>
  );
}
