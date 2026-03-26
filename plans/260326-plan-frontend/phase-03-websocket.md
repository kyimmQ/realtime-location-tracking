---
title: "Phase 3: WebSocket Integration"
description: "Connect frontend WebSocket to backend, wire updates to Zustand store"
status: pending
priority: P1
effort: 3h
branch: main
tags: [frontend, react, websocket]
created: 2026-03-26
---

# Phase 3: WebSocket Integration

## Context Links

- Parent: [plan.md](./plan.md)
- Depends on: [Phase 2](./phase-02-live-tracking.md)
- Spec: `SPECIFICATION.md` (WebSocket Protocol)

## Overview

| Field | Value |
|-------|-------|
| Priority | P1 |
| Status | Pending |
| Effort | 3h |

Connect browser to backend WebSocket, receive `location_update` messages, update Zustand store.

## WebSocket Hook

### `src/shared/hooks/useWebSocket.ts`

```typescript
import { useEffect, useRef, useCallback } from 'react';

interface UseWebSocketOptions {
  url: string;
  onMessage: (data: unknown) => void;
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

      // Auto-subscribe to driver after connection
      wsRef.current?.send(JSON.stringify({
        action: 'subscribe',
        driver_id: 'D001',
      }));
    };

    wsRef.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      onMessage(data);
    };

    wsRef.current.onclose = () => {
      onClose?.();
      // Exponential backoff: 1s, 2s, 4s... max 30s
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
}
```

## Wiring in TrackingPage

```typescript
import { useEffect, useCallback } from 'react';
import { useWebSocket } from '../../shared/hooks/useWebSocket';
import { useTrackingStore } from './trackingStore';

export function TrackingPage() {
  const { setPosition, update, addPathPoint } = useTrackingStore();

  const handleMessage = useCallback((data: any) => {
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
      // Dispatch to alert store
      const alertStore = useAlertStore.getState();
      alertStore.addAlert(data.payload);
    }
  }, [setPosition, update, addPathPoint]);

  useWebSocket({
    url: 'ws://localhost:8080/ws/tracking',
    onMessage: handleMessage,
  });

  // ... rest of component
}
```

## Todo List

- [ ] Implement useWebSocket hook with reconnection
- [ ] Wire to TrackingPage
- [ ] Wire alert messages to alert store
- [ ] Test with backend running
- [ ] Verify marker moves when WS message received

## Success Criteria

- WebSocket connects on page load
- After `subscribe` → location updates arrive
- Marker moves smoothly on map
- ETA/speed/distance update in real-time
- Alert messages (type: "alert") dispatch to alert store
- Reconnection works if backend restarts

## Troubleshooting

```bash
# Check backend is running
curl http://localhost:8080/health

# Check WebSocket upgrade works
curl -i -N \
  -H "Connection: Upgrade" \
  -H "Upgrade: websocket" \
  http://localhost:8080/ws/tracking
```
