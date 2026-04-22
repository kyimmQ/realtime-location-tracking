import { useQuery } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../../shared/hooks/useAuth'
import { MapContainer, TileLayer, Polyline, Marker } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Button } from '../../components/ui/Button'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080'

// Leaflet default marker fix
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon   from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _leafletIcon = L.icon({ iconUrl: markerIcon, iconRetinaUrl: markerIcon2x, shadowUrl: markerShadow, iconSize: [25, 41], iconAnchor: [12, 41] })
L.Marker.prototype.options.icon = _leafletIcon

export function TripPlayback() {
  const { accessToken } = useAuth()
  const [selectedTrip, setSelectedTrip]   = useState('')
  const [playbackIndex, setPlaybackIndex] = useState(0)
  const [isPlaying, setIsPlaying]         = useState(false)
  const playbackRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined)
  const markerRef   = useRef<L.Marker>(null)

  // Trip list
  const { data: trips = [] } = useQuery<{ trip_id: string; status: string }[]>({
    queryKey: ['trips', accessToken],
    queryFn: () =>
      fetch(`${API_BASE}/api/trips`, {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      }).then(r => r.json()).catch(() => []),
    enabled: !!accessToken,
  })

  // Full route
  const { data: routePoints = [] } = useQuery<{ latitude: number; longitude: number }[]>({
    queryKey: ['trips', selectedTrip, 'route', accessToken],
    queryFn: () =>
      fetch(`${API_BASE}/api/trips/${selectedTrip}/route`, {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      }).then(r => r.json()).catch(() => []),
    enabled: !!selectedTrip && !!accessToken,
  })

  // Playback animation
  useEffect(() => {
    if (isPlaying && routePoints.length > 0) {
      playbackRef.current = setInterval(() => {
        setPlaybackIndex(i => (i + 1) % routePoints.length)
      }, 500)
    }
    return () => clearInterval(playbackRef.current)
  }, [isPlaying, routePoints.length])

  const currentPoint = routePoints[playbackIndex]
  const traveledPath = routePoints.slice(0, playbackIndex + 1)

  const handleSelectTrip = (tripId: string) => {
    setSelectedTrip(tripId)
    setPlaybackIndex(0)
    setIsPlaying(false)
  }

  const progress = routePoints.length > 0 ? ((playbackIndex + 1) / routePoints.length) * 100 : 0

  return (
    <div>
      {/* Header */}
      <div className="mb-5">
        <h2 className="text-xl font-bold text-surface-900">Trip Playback</h2>
        <p className="text-sm text-surface-500 mt-0.5">Review completed delivery routes</p>
      </div>

      {/* Trip selector */}
      <div className="mb-5">
        <label className="block text-sm font-medium text-surface-700 mb-2">Select Trip</label>
        <select
          value={selectedTrip}
          onChange={e => handleSelectTrip(e.target.value)}
          className="w-full border border-surface-200 rounded-xl px-4 py-2.5 text-sm font-medium text-surface-700 bg-white
            hover:border-surface-300 focus:outline-none focus:ring-2 focus:ring-admin-500 focus:border-transparent transition-colors"
        >
          <option value="">— Choose a trip —</option>
          {trips.map((t: { trip_id: string; status: string }) => (
            <option key={t.trip_id} value={t.trip_id}>
              Trip {t.trip_id.slice(0,8).toUpperCase()} — {t.status}
            </option>
          ))}
        </select>
      </div>

      {/* Playback UI */}
      {selectedTrip && routePoints.length > 0 && currentPoint && (
        <div className="space-y-4">
          {/* Controls */}
          <div className="card p-4 flex flex-col sm:flex-row items-start sm:items-center gap-4">
            {/* Play/Pause */}
            <Button
              variant={isPlaying ? 'secondary' : 'primary'}
              size="md"
              onClick={() => setIsPlaying(p => !p)}
              icon={
                isPlaying ? (
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <rect x="6" y="4" width="4" height="16"/>
                    <rect x="14" y="4" width="4" height="16"/>
                  </svg>
                ) : (
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <polygon points="5 3 19 12 5 21 5 3"/>
                  </svg>
                )
              }
            >
              {isPlaying ? 'Pause' : 'Play'}
            </Button>

            {/* Restart */}
            <Button variant="secondary" size="md" onClick={() => setPlaybackIndex(0)}>
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 4v6h6"/>
                <path d="M3.51 15a9 9 0 1 0 .49-3.5"/>
              </svg>
              Restart
            </Button>

            {/* Progress info */}
            <div className="flex-1 w-full">
              <div className="flex justify-between text-xs text-surface-500 mb-1.5">
                <span>Point {playbackIndex + 1} / {routePoints.length}</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <div className="h-2 bg-surface-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-admin-500 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </div>

          {/* Map */}
          <div className="rounded-xl overflow-hidden shadow-card border border-surface-100">
            <MapContainer
              center={[currentPoint.latitude, currentPoint.longitude]}
              zoom={14}
              className="h-[400px] w-full"
              zoomControl={true}
            >
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

              {/* Full planned route */}
              <Polyline
                positions={routePoints.map(p => [p.latitude, p.longitude])}
                color="#94A3B8"
                weight={3}
                opacity={0.5}
                dashArray="6 4"
              />

              {/* Traveled portion */}
              {traveledPath.length > 1 && (
                <Polyline
                  positions={traveledPath.map(p => [p.latitude, p.longitude])}
                  color="#6366F1"
                  weight={4}
                  opacity={0.9}
                />
              )}

              {/* Current position */}
              <Marker
                ref={markerRef}
                position={[currentPoint.latitude, currentPoint.longitude]}
              />
            </MapContainer>

            {/* Map footer */}
            <div className="px-4 py-2.5 bg-surface-50 border-t border-surface-100 flex items-center gap-4 text-xs text-surface-500">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 bg-admin-500 rounded-full inline-block"/>Traveled
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 bg-surface-300 rounded-full inline-block" style={{borderBottom:'1px dashed #94A3B8'}}/>Planned
              </span>
              <span className="ml-auto font-mono">
                {currentPoint.latitude.toFixed(5)}, {currentPoint.longitude.toFixed(5)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!selectedTrip && (
        <div className="card-body text-center py-16">
          <div className="w-14 h-14 rounded-2xl bg-admin-50 flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-admin-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="5 3 19 12 5 21 5 3"/>
            </svg>
          </div>
          <h3 className="text-base font-semibold text-surface-700 mb-1">Select a Trip</h3>
          <p className="text-sm text-surface-400">Choose a trip above to replay its route</p>
        </div>
      )}
    </div>
  )
}
