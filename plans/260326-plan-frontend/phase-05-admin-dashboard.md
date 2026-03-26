---
title: "Phase 5: Admin Dashboard"
description: "Admin dashboard: speed alerts, proximity alerts, trip playback, driver analytics, heatmap"
status: pending
priority: P1
effort: 3h
branch: main
tags: [frontend, react]
created: 2026-03-26
---

# Phase 5: Admin Dashboard

## Context Links

- Parent: [plan.md](./plan.md)
- Depends on: [Phase 3](./phase-03-websocket.md) (WebSocket)
- Spec: `SPECIFICATION.md` (Admin User Story §2.3)

## Overview

| Field | Value |
|-------|-------|
| Priority | P1 |
| Status | Pending |
| Effort | 3h |

Fleet manager dashboard: real-time safety alerts, trip playback, driver analytics, service area heatmap.

## Components

### `src/features/admin/adminStore.ts`

```typescript
import { create } from 'zustand';

interface Alert {
  alert_id: string;
  alert_type: 'SPEEDING' | 'PROXIMITY';
  driver_id: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  message: string;
  timestamp: string;
  metadata: Record<string, string>;
}

interface AdminState {
  activeAlerts: Alert[];
  addAlert: (alert: Alert) => void;
  dismissAlert: (alertId: string) => void;
  clearAll: () => void;
}

export const useAdminStore = create<AdminState>((set) => ({
  activeAlerts: [],
  addAlert: (alert) =>
    set((s) => ({
      activeAlerts: [alert, ...s.activeAlerts].slice(0, 50), // keep last 50
    })),
  dismissAlert: (id) =>
    set((s) => ({ activeAlerts: s.activeAlerts.filter(a => a.alert_id !== id) })),
  clearAll: () => set({ activeAlerts: [] }),
}));
```

### `src/features/admin/AdminPage.tsx`

```typescript
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useAdminStore } from './adminStore';
import { TripPlayback } from './TripPlayback';
import { DriverAnalytics } from './DriverAnalytics';
import { ServiceHeatmap } from './ServiceHeatmap';
import { AlertFeed } from './AlertFeed';
import { useWebSocket } from '../../shared/hooks/useWebSocket';

export function AdminPage() {
  const [activeTab, setActiveTab] = useState<'alerts' | 'playback' | 'analytics' | 'heatmap'>('alerts');
  const { addAlert } = useAdminStore();

  // Subscribe to alerts WebSocket
  const handleMessage = useCallback((data: any) => {
    if (data.type === 'alert') {
      addAlert(data.payload);
    }
  }, [addAlert]);

  useWebSocket({
    url: 'ws://localhost:8080/ws/tracking',
    onMessage: handleMessage,
    onOpen: () => {
      // Subscribe to all alerts
      ws?.send(JSON.stringify({ action: 'subscribe_alerts' }));
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
```

### `src/features/admin/AlertFeed.tsx`

Real-time scrolling alert feed with SPEEDING and PROXIMITY types.

```typescript
export function AlertFeed() {
  const { activeAlerts, dismissAlert, clearAll } = useAdminStore();

  const severityColor = {
    HIGH: 'bg-red-100 border-red-500 text-red-800',
    MEDIUM: 'bg-yellow-100 border-yellow-500 text-yellow-800',
    LOW: 'bg-blue-100 border-blue-500 text-blue-800',
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-bold">Live Alerts ({activeAlerts.length})</h2>
        {activeAlerts.length > 0 && (
          <button onClick={clearAll} className="text-sm text-gray-500 hover:text-gray-700">
            Clear all
          </button>
        )}
      </div>

      {activeAlerts.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p className="text-4xl mb-2">✓</p>
          <p>No active alerts</p>
        </div>
      ) : (
        <div className="space-y-3">
          {activeAlerts.map(alert => (
            <div
              key={alert.alert_id}
              className={`border-l-4 rounded p-4 shadow ${severityColor[alert.severity]}`}
            >
              <div className="flex justify-between">
                <span className="font-bold text-sm uppercase">{alert.alert_type}</span>
                <span className="text-xs">{alert.timestamp}</span>
              </div>
              <p className="mt-1">{alert.message}</p>
              <div className="mt-2 flex justify-between items-center">
                <span className="text-xs text-gray-500">Driver: {alert.driver_id}</span>
                <button
                  onClick={() => dismissAlert(alert.alert_id)}
                  className="text-xs text-gray-400 hover:text-gray-600"
                >
                  Dismiss
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

### `src/features/admin/TripPlayback.tsx` (Requirement 5)

Fetch GPS trace from API, animate marker along route.

```typescript
import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Polyline, Marker } from 'react-leaflet';
import L from 'leaflet';

export function TripPlayback() {
  const [selectedTrip, setSelectedTrip] = useState('');
  const [playbackIndex, setPlaybackIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const playbackRef = useRef<ReturnType<typeof setInterval>>();

  // Get list of completed trips
  const { data: trips = [] } = useQuery({
    queryKey: ['trips'],
    queryFn: () => fetch('/api/trips').then(r => r.json()),
  });

  // Get full route for selected trip
  const { data: routePoints = [] } = useQuery({
    queryKey: ['trips', selectedTrip, 'route'],
    queryFn: () => fetch(`/api/trips/${selectedTrip}/route`).then(r => r.json()),
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
        {trips.map((t: any) => (
          <option key={t.trip_id} value={t.trip_id}>
            Trip {t.trip_id.slice(0,8)} — {t.status}
          </option>
        ))}
      </select>

      {selectedTrip && routePoints.length > 0 && (
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
              positions={routePoints.map((p: any) => [p.latitude, p.longitude])}
              color="gray"
              weight={2}
              opacity={0.5}
            />

            {/* Traveled path */}
            <Polyline
              positions={traveledPath.map((p: any) => [p.latitude, p.longitude])}
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
```

### `src/features/admin/DriverAnalytics.tsx` (Requirement 6)

```typescript
export function DriverAnalytics() {
  const [selectedDriver, setSelectedDriver] = useState('D001');

  const { data: analytics = [] } = useQuery({
    queryKey: ['drivers', selectedDriver, 'analytics'],
    queryFn: () =>
      fetch(`/api/drivers/${selectedDriver}/analytics`).then(r => r.json()),
  });

  return (
    <div>
      <h2 className="text-lg font-bold mb-4">Driver Analytics</h2>

      <select
        value={selectedDriver}
        onChange={(e) => setSelectedDriver(e.target.value)}
        className="border rounded px-3 py-2 mb-4"
      >
        <option value="D001">Driver D001</option>
      </select>

      {analytics.length === 0 ? (
        <p className="text-gray-500">No analytics data available</p>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {analytics.map((week: any) => (
            <div key={week.week_start_date} className="border rounded p-4 shadow">
              <h3 className="font-bold">{week.week_start_date}</h3>
              <div className="mt-2 space-y-1 text-sm">
                <p>🚗 Total trips: <strong>{week.total_trips}</strong></p>
                <p>📍 Distance: <strong>{week.total_distance?.toFixed(1)} km</strong></p>
                <p>⚡ Avg speed: <strong>{week.average_speed?.toFixed(1)} km/h</strong></p>
                <p>🚨 Speeding violations: <strong className="text-red-600">{week.speeding_violations}</strong></p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

### `src/features/admin/ServiceHeatmap.tsx` (Requirement 8)

```typescript
export function ServiceHeatmap() {
  // Fetch heatmap data (grouped by geohash cells)
  const { data: cells = [] } = useQuery({
    queryKey: ['admin', 'heatmap'],
    queryFn: () => {
      const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      return fetch(`/api/admin/heatmap?since=${since}`).then(r => r.json());
    },
  });

  // Simple color gradient: gray → yellow → orange → red
  const getColor = (count: number, max: number) => {
    const ratio = count / max;
    if (ratio < 0.33) return '#ffffb2';  // yellow
    if (ratio < 0.66) return '#fecc5c';  // orange
    return '#fd8d3c';                     // red
  };

  const maxCount = Math.max(...cells.map((c: any) => c.delivery_count), 1);

  return (
    <div>
      <h2 className="text-lg font-bold mb-4">Service Area Heatmap (Last 7 Days)</h2>

      {/* Simple table visualization (for PoC) */}
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left">
            <th className="p-2">Zone</th>
            <th className="p-2">Deliveries</th>
            <th className="p-2">Density</th>
          </tr>
        </thead>
        <tbody>
          {cells.map((cell: any) => (
            <tr key={cell.geohash} className="border-t">
              <td className="p-2 font-mono text-xs">{cell.geohash}</td>
              <td className="p-2">{cell.delivery_count}</td>
              <td className="p-2">
                <div className="w-24 h-4 rounded overflow-hidden">
                  <div
                    className="h-full"
                    style={{
                      width: `${(cell.delivery_count / maxCount) * 100}%`,
                      backgroundColor: getColor(cell.delivery_count, maxCount),
                    }}
                  />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

## Todo List

- [ ] Admin store (Zustand) for alerts
- [ ] AdminPage with tab navigation
- [ ] AlertFeed (live alerts from WebSocket)
- [ ] TripPlayback (route fetch + animated replay)
- [ ] DriverAnalytics (weekly stats from API)
- [ ] ServiceHeatmap (geo-hash density table)
- [ ] WebSocket: subscribe to alerts topic

## Success Criteria

- Admin dashboard shows live alerts as they arrive via WebSocket
- SPEEDING alerts appear in red, PROXIMITY alerts in yellow
- Trip playback: map animates through GPS points when Play is clicked
- Driver analytics: weekly stats displayed in cards
- Heatmap: delivery density per geo-hash cell shown
