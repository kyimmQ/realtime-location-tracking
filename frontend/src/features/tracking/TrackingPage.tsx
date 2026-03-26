import { TrackingMap } from './TrackingMap';
import { useTrackingStore } from './trackingStore';

export function TrackingPage() {
  const { etaSeconds, distanceKm, speed, driverPosition } = useTrackingStore();

  const formatETA = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="max-w-2xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Live Delivery Tracking</h1>

      {/* Status bar */}
      <div className="bg-white rounded-lg shadow p-4 mb-4 flex justify-around text-center">
        <div>
          <div className="text-2xl font-bold">{formatETA(etaSeconds)}</div>
          <div className="text-gray-500 text-sm">ETA</div>
        </div>
        <div>
          <div className="text-2xl font-bold">{distanceKm.toFixed(1)} km</div>
          <div className="text-gray-500 text-sm">Distance</div>
        </div>
        <div>
          <div className="text-2xl font-bold">{speed.toFixed(0)} km/h</div>
          <div className="text-gray-500 text-sm">Speed</div>
        </div>
        <div>
          <div className={`text-2xl font-bold ${driverPosition ? 'text-green-600' : 'text-gray-400'}`}>
            {driverPosition ? 'Active' : 'Waiting...'}
          </div>
          <div className="text-gray-500 text-sm">Driver</div>
        </div>
      </div>

      {/* Map */}
      <TrackingMap />
    </div>
  );
}
