import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Polyline, Marker } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet marker icons
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';

const defaultIcon = L.icon({
  iconUrl,
  iconRetinaUrl,
  shadowUrl,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = defaultIcon;

export function TripPlayback() {
  const [selectedTrip, setSelectedTrip] = useState('');
  const [playbackIndex, setPlaybackIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const playbackRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const markerRef = useRef<L.Marker>(null);

  // Get list of completed trips
  const { data: trips = [] } = useQuery({
    queryKey: ['trips'],
    queryFn: () => fetch('http://localhost:8080/api/trips').then(r => r.json()).catch(() => []),
  });

  // Get full route for selected trip
  const { data: routePoints = [] } = useQuery({
    queryKey: ['trips', selectedTrip, 'route'],
    queryFn: () => fetch(`http://localhost:8080/api/trips/${selectedTrip}/route`).then(r => r.json()).catch(() => []),
    enabled: !!selectedTrip,
  });

  // Playback animation
  useEffect(() => {
    if (isPlaying && routePoints.length > 0) {
      playbackRef.current = setInterval(() => {
        setPlaybackIndex(i => (i + 1) % routePoints.length);
      }, 500); // 500ms per point
    }
    return () => clearInterval(playbackRef.current);
  }, [isPlaying, routePoints.length]);

  const currentPoint = routePoints[playbackIndex];
  const traveledPath = routePoints.slice(0, playbackIndex + 1);

  return (
    <div>
      <h2 className="text-lg font-bold mb-4">Trip Playback</h2>

      {/* Trip selector */}
      <select
        value={selectedTrip}
        onChange={(e) => { setSelectedTrip(e.target.value); setPlaybackIndex(0); setIsPlaying(false); }}
        className="border rounded px-3 py-2 mb-4 w-full"
      >
        <option value="">Select a trip...</option>
        {trips.map((t: { trip_id: string; status: string }) => (
          <option key={t.trip_id} value={t.trip_id}>
            Trip {t.trip_id.slice(0,8)} — {t.status}
          </option>
        ))}
      </select>

      {selectedTrip && routePoints.length > 0 && currentPoint && (
        <>
          {/* Playback controls */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="px-4 py-2 bg-red-600 text-white rounded"
            >
              {isPlaying ? '⏸ Pause' : '▶️ Play'}
            </button>
            <button
              onClick={() => setPlaybackIndex(0)}
              className="px-4 py-2 border rounded"
            >
              ↺ Restart
            </button>
            <span className="py-2 text-gray-600">
              Point {playbackIndex + 1} / {routePoints.length}
            </span>
          </div>

          {/* Map */}
          <MapContainer
            center={[currentPoint.latitude, currentPoint.longitude]}
            zoom={14}
            className="h-[400px] w-full rounded"
          >
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

            {/* Full route */}
            <Polyline
              positions={routePoints.map((p: { latitude: number; longitude: number }) => [p.latitude, p.longitude])}
              color="gray"
              weight={2}
              opacity={0.5}
            />

            {/* Traveled path */}
            <Polyline
              positions={traveledPath.map((p: { latitude: number; longitude: number }) => [p.latitude, p.longitude])}
              color="blue"
              weight={4}
            />

            {/* Current marker */}
            <Marker
              ref={markerRef}
              position={[currentPoint.latitude, currentPoint.longitude]}
            />
          </MapContainer>
        </>
      )}
    </div>
  );
}
