---
title: "Phase 2: Live Tracking View"
description: "Leaflet map with driver marker, destination marker, polyline route"
status: pending
priority: P1
effort: 4h
branch: main
tags: [frontend, react, leaflet]
created: 2026-03-26
---

# Phase 2: Live Tracking View

## Context Links

- Parent: [plan.md](./plan.md)
- Depends on: [Phase 1](./phase-01-project-setup.md)
- Spec: `SPECIFICATION.md` (Customer View)

## Overview

| Field | Value |
|-------|-------|
| Priority | P1 |
| Status | Pending |
| Effort | 4h |

## Components

### `src/shared/types/index.ts`

```typescript
export interface LocationUpdate {
  type: 'location_update';
  driver_id: string;
  latitude: number;
  longitude: number;
  speed: number;
  eta_seconds: number;
  distance_km: number;
}

export interface WebSocketMessage {
  type: 'location_update';
  payload: LocationUpdate;
}
```

### `src/features/tracking/trackingStore.ts`

```typescript
import { create } from 'zustand';

interface TrackingState {
  driverPosition: { lat: number; lng: number } | null;
  etaSeconds: number;
  distanceKm: number;
  speed: number;
  traveledPath: [number, number][];
  setPosition: (lat: number, lng: number) => void;
  update: (update: Partial<{ etaSeconds: number; distanceKm: number; speed: number }>) => void;
  addPathPoint: (lat: number, lng: number) => void;
}

export const useTrackingStore = create<TrackingState>((set) => ({
  driverPosition: null,
  etaSeconds: 0,
  distanceKm: 0,
  speed: 0,
  traveledPath: [],

  setPosition: (lat, lng) => set({ driverPosition: { lat, lng } }),

  update: (update) => set((s) => ({ ...s, ...update })),

  addPathPoint: (lat, lng) =>
    set((s) => ({ traveledPath: [...s.traveledPath, [lat, lng]] })),
}));
```

### `src/features/tracking/TrackingMap.tsx`

```typescript
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
const DEST_LAT = 10.782345;
const DEST_LON = 106.695123;
const DEST: [number, number] = [DEST_LAT, DEST_LON];

export function TrackingMap() {
  const driverMarkerRef = useRef<L.Marker>(null);
  const { driverPosition, traveledPath } = useTrackingStore();

  // Update marker position imperatively (NOT via React state)
  useEffect(() => {
    if (driverMarkerRef.current && driverPosition) {
      driverMarkerRef.current.setLatLng([driverPosition.lat, driverPosition.lng]);
    }
  }, [driverPosition]);

  // Initial map center = first known position or destination
  const mapCenter: [number, number] = driverPosition
    ? [driverPosition.lat, driverPosition.lng]
    : [10.762622, 106.660172]; // Starting point

  return (
    <MapContainer center={mapCenter} zoom={14} className="h-[500px] w-full rounded-lg">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {/* Destination marker */}
      <Marker position={DEST} icon={destIcon}>
        <Popup>Destination</Popup>
      </Marker>

      {/* Driver marker - created once, moved via ref */}
      <Marker ref={driverMarkerRef} icon={driverIcon} position={mapCenter}>
        <Popup>Driver</Popup>
      </Marker>

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
```

### `src/features/tracking/TrackingPage.tsx`

```typescript
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
```

### SVG Icons (public/driver.svg, public/dest.svg)

Create simple SVG icons (car for driver, pin for destination).

## Todo List

- [ ] Shared types
- [ ] Zustand tracking store
- [ ] TrackingMap with imperative marker
- [ ] TrackingPage with status bar
- [ ] Create SVG icons
- [ ] Style with basic CSS

## Success Criteria

- Map renders centered on starting location
- Destination marker visible
- When driver position updates → marker moves smoothly (no flicker)
- Polyline grows as driver moves
- ETA/speed/distance display updates
