# Research Report: Frontend Implementation for Real-Time Delivery Tracking System

**Date:** 2026-03-26
**Author:** Research Agent
**Scope:** React + Leaflet + WebSocket frontend stack for a greenfield delivery tracking app

---

## Executive Summary

**Vite** is the recommended build tool over Create React App (CRA is effectively deprecated). **TypeScript is mandatory** given the real-time, multi-view complexity. For state management: **React Query (TanStack Query) for API calls** and **Zustand for WebSocket/UI state**. react-leaflet v4 + Leaflet 1.9 is the map stack with specific patterns needed to avoid marker re-render thrashing. A feature-based project structure scales better than layer-based for this domain.

---

## 1. React Project Setup

### Vite vs CRA

**Recommendation: Vite** (non-negotiable for new projects in 2026).

- CRA is officially deprecated; no active development since ~2022.
- Vite provides 10-100x faster dev server cold starts via native ESM.
- HMR is near-instant (<50ms) regardless of app size.
- Native TypeScript support with `vite-plugin-tsconfig-paths`.
- Plugin ecosystem (react, SWC, PWA) is mature and actively maintained.

**Scaffold:**
```bash
npm create vite@latest my-app -- --template react-ts
```

### TypeScript

**Strongly recommended.** Required for:
- WebSocket message schema validation (location_update, alert, status_update).
- Shared types between frontend and backend (via monorepo or shared package).
- Marker/Polyline geometry types from Leaflet definitions (`@types/leaflet`).

### Key Dependencies

| Package | Version | Purpose |
|---|---|---|
| `react` | ^19 | UI framework |
| `react-dom` | ^19 | DOM renderer |
| `react-leaflet` | ^4.2 | React bindings for Leaflet |
| `leaflet` | ^1.9 | Map rendering engine |
| `@tanstack/react-query` | ^5 | API state + caching |
| `zustand` | ^5 | Lightweight state (WebSocket data, UI state) |
| `axios` | ^1 | HTTP client (React Query can also fetch) |
| `react-router-dom` | ^7 | Routing (Customer/Driver/Admin views) |
| `lucide-react` | latest | Icons (replaces outdated icon libs) |
| `date-fns` | latest | Date/time formatting for ETA |

**Do NOT use:** Redux Toolkit (overkill), MobX (complexity for this scale), SWR alone (React Query is strictly superior).

### Project Structure (Feature-Based)

```
src/
  features/
    auth/           # Login, auth context
    orders/         # Order creation, list, detail
    tracking/       # Live map, driver location, route
    analytics/      # Admin charts, heatmap
    notifications/  # Alert toasts
  shared/
    components/     # StatusBadge, LoadingSpinner, ErrorBoundary
    hooks/          # useWebSocket, useETA, useReconnect
    types/          # Shared TS interfaces (Order, Location, Driver)
    utils/          # formatters, validators
  App.tsx
  main.tsx
```

**Layer-based is NOT recommended** (hooks/ with useTracking, useOrders, etc. scattered across a flat hooks/ directory becomes unmaintainable at scale).

---

## 2. Map Integration (react-leaflet)

### Tile Layer (OpenStreetMap)

```tsx
<MapContainer center={[35.6812, 139.7671]} zoom={14} className="map-container">
  <TileLayer
    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
  />
  {/* markers, polylines here */}
</MapContainer>
```

For production performance, consider a commercial tile provider (MapTiler, Stadia Maps) as OSM has strict usage limits. **MapLibre GL** is the open-source alternative for vector tiles if performance becomes an issue.

### Marker Management (Critical)

**The #1 pitfall in react-leaflet is marker re-renders causing map flicker.**

Pattern: Use `useMap` hook + Leaflet refs, NOT React state for marker positions.

```tsx
// CORRECT: Imperative marker management via refs
const driverMarkerRef = useRef<L.Marker>(null);

useEffect(() => {
  if (driverMarkerRef.current && position) {
    driverMarkerRef.current.setLatLng([position.lat, position.lng]);
  }
}, [position]);

// In JSX - create marker once, never re-create
<MapContainer ...>
  <TileLayer ... />
  <Marker ref={driverMarkerRef} icon={driverIcon}>
    <Popup>Driver location</Popup>
  </Marker>
</MapContainer>
```

**Anti-pattern to avoid:** Putting `position` in React state and re-rendering `<Marker position={position} />` on every WebSocket update. This causes full marker DOM recreation ~every 3-5 seconds and causes visible map jitter.

### Icon Customization

```tsx
import L from 'leaflet';
const driverIcon = L.icon({
  iconUrl: '/icons/driver.svg',
  iconSize: [40, 40],
  iconAnchor: [20, 20],
});
const customerIcon = L.icon({ iconUrl: '/icons/customer.svg', ... });
const destIcon = L.icon({ iconUrl: '/icons/destination.svg', ... });
```

Use `L.DivIcon` with inline SVG for dynamic icons (e.g., driver heading rotation) to avoid image loading latency.

### Route Polyline

```tsx
// Draw the expected route path
const routePositions: [number, number][] = waypoints.map(w => [w.lat, w.lng]);

<Polyline
  positions={routePositions}
  color="blue"
  weight={4}
  opacity={0.7}
  dashArray="5, 10"  // dashed line for expected path
/>
```

For **live traveled path** (what the driver has actually covered), maintain a separate polyline array that grows as new location updates arrive.

### Map Component Architecture

Extract `<TrackingMap />` as its own feature component that receives:
- `driverPosition: [number, number] | null`
- `customerPosition: [number, number]`
- `destinationPosition: [number, number]`
- `routeWaypoints: [number, number][]`
- `traveledPath: [number, number][]`

The map component internally uses refs for markers and does NOT re-render on every position update.

---

## 3. Real-Time WebSocket Client

### Custom `useWebSocket` Hook

Implement as a custom hook, NOT a library dependency. Libraries like `react-use-websocket` exist but add unnecessary abstraction for the custom reconnection logic needed here.

```tsx
// src/shared/hooks/useWebSocket.ts
interface UseWebSocketOptions {
  url: string;
  onMessage: (data: LocationUpdate | Alert | StatusUpdate) => void;
  onOpen?: () => void;
  onClose?: () => void;
}

export function useWebSocket({ url, onMessage, onOpen, onClose }: UseWebSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const retryCountRef = useRef(0);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const connect = useCallback(() => {
    wsRef.current = new WebSocket(url);

    wsRef.current.onopen = () => {
      retryCountRef.current = 0;
      onOpen?.();
    };

    wsRef.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      onMessage(data);
    };

    wsRef.current.onclose = () => {
      onClose?.();
      // Exponential backoff: 1s, 2s, 4s, 8s, max 30s
      const delay = Math.min(1000 * 2 ** retryCountRef.current, 30000);
      retryCountRef.current++;
      retryTimeoutRef.current = setTimeout(connect, delay);
    };

    wsRef.current.onerror = () => {
      wsRef.current?.close();
    };
  }, [url, onMessage, onOpen, onClose]);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(retryTimeoutRef.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const send = useCallback((data: object) => {
    wsRef.current?.send(JSON.stringify(data));
  }, []);

  return { send };
}
```

### Message Types

Define as TypeScript discriminated union:

```tsx
type WebSocketMessage =
  | { type: 'location_update'; payload: { driverId: string; lat: number; lng: number; heading: number; speed: number; timestamp: string } }
  | { type: 'alert'; payload: { level: 'info' | 'warning' | 'critical'; message: string } }
  | { type: 'status_update'; payload: { orderId: string; status: OrderStatus; updatedAt: string } };

type OrderStatus = 'pending' | 'assigned' | 'picked_up' | 'in_transit' | 'delivered' | 'cancelled';
```

### State Management for Real-Time Data

**Recommendation: Zustand + React Context hybrid.**

- **Zustand store** for WebSocket-derived state (driver positions, order statuses, traveled paths). Zustand is ideal because:
  - Minimal boilerplate.
  - Supports subscriptions with selector functions (`useDriverPosition(driverId)`).
  - No provider wrapper hell.
  - Works outside React components if needed (e.g., WebSocket callbacks).

- **React Context** only for auth/session data (already likely in the codebase).

```tsx
// src/features/tracking/store/trackingStore.ts
import { create } from 'zustand';

interface DriverPosition { lat: number; lng: number; heading: number; speed: number; }
interface TrackingState {
  driverPositions: Record<string, DriverPosition>;
  traveledPaths: Record<string, [number, number][]>;
  updateDriverPosition: (driverId: string, pos: DriverPosition) => void;
  addToTraveledPath: (driverId: string, point: [number, number]) => void;
}

export const useTrackingStore = create<TrackingState>((set) => ({
  driverPositions: {},
  traveledPaths: {},
  updateDriverPosition: (driverId, pos) =>
    set((s) => ({ driverPositions: { ...s.driverPositions, [driverId]: pos } })),
  addToTraveledPath: (driverId, point) =>
    set((s) => ({
      traveledPaths: {
        ...s.traveledPaths,
        [driverId]: [...(s.traveledPaths[driverId] ?? []), point],
      },
    })),
}));
```

WebSocket `onMessage` handler calls `updateDriverPosition` and `addToTraveledPath` directly from the store. No React re-render triggering the WebSocket -- only Zustand subscription updates the relevant components.

---

## 4. UI Components

### Customer View
- **Order placement form** (address autocomplete via OSM Nominatim or a commercial geocoder).
- **Live tracking map** (tracking feature) showing driver icon moving in real-time.
- **ETA display** (calculated client-side from driver speed + distance, or server-provided).
- **Notification toasts** for status changes and alerts (use `react-hot-toast` or similar).

### Driver View
- **Order list** with filtering by status (pending, active, completed).
- **Status update buttons** (Accept, Picked Up, Delivered) -- these trigger optimistic updates via React Query.
- **Navigation display** -- a simplified map showing next destination, NOT the full customer-tracking map.

### Admin View
- **Trip list** with real-time status indicators (colored badges).
- **Analytics charts** -- use Recharts (lightweight, composable, good React integration). Common charts: deliveries per day, average delivery time, active drivers map.
- **Heatmap visualization** -- Leaflet's `HeatMap` layer plugin (`leaflet.heat`) for delivery density.

### Shared Components
- `<StatusBadge status={OrderStatus} />` -- colored pill (green=delivered, blue=in_transit, etc.).
- `<LoadingSpinner />`, `<ErrorBoundary />`, `<Toast />`.
- `<ConfirmDialog />` for destructive actions (cancel order).

### Optimistic Updates for Status Changes

```tsx
// In driver view, using React Query
const updateStatus = useMutation({
  mutationFn: (payload: { orderId: string; status: OrderStatus }) =>
    api.patch(`/orders/${payload.orderId}/status`, { status: payload.status }),
  onMutate: async (newStatus) => {
    await queryClient.cancelQueries({ queryKey: ['orders'] });
    const previous = queryClient.getQueryData(['orders']);
    queryClient.setQueryData(['orders'], (old: Order[]) =>
      old.map(o => o.id === newStatus.orderId ? { ...o, status: newStatus.status } : o)
    );
    return { previous };
  },
  onError: (_err, _newStatus, context) => {
    queryClient.setQueryData(['orders'], context?.previous);
  },
  onSettled: () => queryClient.invalidateQueries({ queryKey: ['orders'] }),
});
```

---

## 5. State Management

### React Query (TanStack Query) for API State

- **API calls** (order CRUD, auth, driver list, analytics) via React Query.
- Handles caching, background refetching, pagination.
- Integrates with optimistic updates as shown above.
- Use `queryClient.invalidateQueries()` after WebSocket `status_update` messages to sync API cache.

### Zustand for WebSocket / Real-Time State

- Driver positions (updated every 3-5s via WebSocket).
- Traveled paths (accumulates over time).
- UI state that changes frequently (selected driver, map center, zoom level).
- Alert queue for toast notifications.

### What NOT to Use

- **Redux Toolkit** -- overkill for this app size; too much boilerplate for the benefit.
- **MobX** -- OOP patterns don't fit well with React's component model for this use case.
- **SWR alone** -- React Query is a strict superset of SWR; no reason to choose SWR.

---

## Critical Implementation Considerations

1. **Marker stability** -- The imperative ref pattern for Leaflet markers is non-negotiable. Position updates from WebSocket must flow through refs, NOT React state props, to avoid map flicker.
2. **WebSocket backpressure** -- If device sends location every 1s, ensure the client can handle it. Throttle Zustand updates if needed (requestAnimationFrame or 2s debounce for map center sync).
3. **WebSocket + React Query cache sync** -- After a `status_update` WebSocket message, invalidate the relevant React Query query so the next API fetch gets fresh data. Don't try to mutate React Query cache from WebSocket callbacks directly.
4. **PWA considerations** -- Service worker for offline order viewing (read-only tracking when connectivity is lost).
5. **TypeScript strict mode** -- Enable `strict: true` in tsconfig; enables `noUncheckedIndexedAccess` which catches array access bugs.
6. **Map SSR** -- react-leaflet does NOT support SSR (Next.js `getServerSideProps` / `getStaticProps`). If using Next.js, use dynamic import with `{ ssr: false }` for MapContainer.

---

## Unresolved Questions

1. **Geocoding provider** -- Is a commercial geocoder (Google Maps, Mapbox) available, or should the app rely on OSM Nominatim (rate-limited, less accurate)? Address autocomplete quality depends on this choice.
2. **Map tile provider for production** -- OSM is fine for development/demo but has strict fair use limits. Has the team budgeted for MapTiler/Stadia Maps for production traffic?
3. **WebSocket protocol** -- Is it a custom protocol or does it follow an existing standard (e.g., Fleet Telematics GTFS, or a backend-provided schema)? Message schemas must be agreed upon before frontend implementation starts.
4. **Real-time data volume** -- How many simultaneous drivers/orders are expected? If >500 active drivers, consider whether a single WebSocket connection is sufficient or if a pub/sub model (via something like Ably or Pusher) is needed.
5. **Admin heatmap data source** -- Is the backend capable of providing aggregated location density data, or must the frontend compute heatmap points from raw WebSocket feeds?
