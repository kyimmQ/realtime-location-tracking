---
title: "Phase 6: Polish & Demo Ready"
description: "Styling, loading states, error handling, demo script for all 3 views"
status: pending
priority: P1
effort: 2h
branch: main
tags: [frontend, react]
created: 2026-03-26
---

# Phase 6: Polish & Demo Ready

## Context Links

- Parent: [plan.md](./plan.md)
- Depends on: [Phase 5](./phase-05-admin-dashboard.md)

## Overview

| Field | Value |
|-------|-------|
| Priority | P1 |
| Status | Pending |
| Effort | 2h |

## Requirements

### UI Polish (All Views)

- Loading spinner while connecting to WebSocket
- "Connecting..." / "Connected" / "Disconnected" status indicator
- Toast notification when driver is close (< 500m)
- Smooth zoom to fit route
- Basic CSS styling (Tailwind)

### Demo Flow — 3 Concurrent Browser Tabs

**Tab 1: Customer View** (`/customer`)
```
1. Start backend (docker-compose + Go + Java)
2. Start frontend (npm run dev)
3. Open /customer → CustomerPage
4. Click "Place Order"
5. Start simulator: go run cmd/simulator/main.go --gpx-file=../gpxs/sample.gpx
6. Watch: driver marker moves, ETA counts down, polyline draws
7. Toast appears when "Driver is 480m away"
```

**Tab 2: Driver View** (`/driver`)
```
1. Open /driver → DriverPage
2. See order assigned → Click "Accept Order"
3. Click through: "Start Picking Up" → "Start Delivery" → "Mark Arriving" → "Mark Delivered"
4. Watch status update in customer tab
```

**Tab 3: Admin Dashboard** (`/admin`)
```
1. Open /admin → AdminPage
2. If GPX has speeding segment: red SPEEDING alert appears
3. When driver < 500m: yellow PROXIMITY alert appears
4. Select completed trip → Click "Play" → Watch route animation
5. View driver analytics cards
6. View heatmap table
```

### Error Handling

- Show "Waiting for driver data..." if no WS messages after 5s
- Show "Connection lost, reconnecting..." if WS disconnects
- Graceful degradation: map still visible even if WS down
- TanStack Query: show error states on failed API calls

## Implementation Steps

1. Add loading/connection state to TrackingPage (customer view)
2. Add "approaching" toast when distance < 0.5km
3. Add basic CSS styling (Tailwind utility classes)
4. Write demo script in README (3-tab setup)
5. Test full end-to-end demo with all 3 views

## Todo List

- [ ] Loading state UI (all 3 views)
- [ ] Connection status indicator
- [ ] Proximity toast notification
- [ ] Basic Tailwind CSS styling
- [ ] Demo script (3-tab concurrent flow)
- [ ] End-to-end test

## Success Criteria

- Customer tab: marker moves, ETA counts down, proximity toast appears
- Driver tab: status buttons work through full lifecycle
- Admin tab: SPEEDING + PROXIMITY alerts appear live, trip playback animates
- No console errors
- Easy for presenter to replicate (3 browser tabs)
