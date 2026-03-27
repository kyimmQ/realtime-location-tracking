import { useState, useCallback } from 'react';
import { useAdminStore } from './adminStore';
import { TripPlayback } from './TripPlayback';
import { DriverAnalytics } from './DriverAnalytics';
import { ServiceHeatmap } from './ServiceHeatmap';
import { AlertFeed } from './AlertFeed';
import { useWebSocket } from '../../shared/hooks/useWebSocket';
import type { WebSocketMessage } from '../../shared/types';

export function AdminPage() {
  const [activeTab, setActiveTab] = useState<'alerts' | 'playback' | 'analytics' | 'heatmap'>('alerts');
  const { addAlert } = useAdminStore();

  // Subscribe to alerts WebSocket
  const handleMessage = useCallback((data: WebSocketMessage) => {
    if (data.type === 'alert') {
      addAlert(data.payload as unknown as Parameters<typeof addAlert>[0]);
    }
  }, [addAlert]);

  useWebSocket({
    url: 'ws://localhost:8080/ws/tracking',
    onMessage: handleMessage,
    onOpen: (ws: WebSocket) => {
      // Subscribe to all alerts
      ws.send(JSON.stringify({ action: 'subscribe_alerts' }));
    },
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-red-600 text-white p-4">
        <h1 className="text-xl font-bold">Fleet Manager Dashboard</h1>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b flex">
        {(['alerts', 'playback', 'analytics', 'heatmap'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-6 py-3 font-medium ${
              activeTab === tab
                ? 'border-b-2 border-red-600 text-red-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {tab === 'alerts' && '🔴 Live Alerts'}
            {tab === 'playback' && '▶️ Trip Playback'}
            {tab === 'analytics' && '📊 Driver Analytics'}
            {tab === 'heatmap' && '🗺️ Service Heatmap'}
          </button>
        ))}
      </div>

      <div className="p-6">
        {activeTab === 'alerts' && <AlertFeed />}
        {activeTab === 'playback' && <TripPlayback />}
        {activeTab === 'analytics' && <DriverAnalytics />}
        {activeTab === 'heatmap' && <ServiceHeatmap />}
      </div>
    </div>
  );
}
