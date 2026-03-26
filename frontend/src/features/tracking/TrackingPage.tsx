import { useCallback } from 'react';
import { TrackingMap } from './TrackingMap';
import { useTrackingStore } from './trackingStore';
import { useAlertStore } from './alertStore';
import { useWebSocket } from '../../shared/hooks/useWebSocket';
import type { WebSocketMessage } from '../../shared/types';

export function TrackingPage() {
  const { setPosition, update, addPathPoint, etaSeconds, distanceKm, speed, driverPosition } = useTrackingStore();
  const { alerts } = useAlertStore();

  const handleMessage = useCallback((data: WebSocketMessage) => {
    if (data.type === 'location_update') {
      const { latitude, longitude, speed, eta_seconds, distance_km } = data.payload;

      setPosition(latitude, longitude);
      update({
        speed,
        etaSeconds: eta_seconds,
        distanceKm: distance_km,
      });
      addPathPoint(latitude, longitude);
    } else if (data.type === 'alert') {
      const alertStore = useAlertStore.getState();
      alertStore.addAlert(data.payload);
    }
  }, [setPosition, update, addPathPoint]);

  useWebSocket({
    url: 'ws://localhost:8080/ws/tracking',
    onMessage: handleMessage,
  });

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

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="mt-4 p-4 bg-red-50 rounded-lg border border-red-200">
          <h2 className="text-lg font-bold text-red-700 mb-2">Recent Alerts</h2>
          <ul className="space-y-2">
            {alerts.map((alert, idx) => (
              <li key={alert.alert_id || idx} className="text-sm text-red-600">
                <strong>{alert.alert_type}:</strong> {alert.message}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
