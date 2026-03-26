---
title: "Frontend Implementation Plan"
description: "React + TypeScript + Vite frontend: customer tracking view, driver view, admin dashboard"
status: pending
priority: P1
effort: 16h
branch: main
tags: [frontend, react, typescript, leaflet]
created: 2026-03-26
---

# Frontend Implementation Plan (Academic PoC)

## Overview

Single GPX file, one driver, one-trip demo flow. **Full business requirements restored** — customer view, driver view, and admin dashboard all implemented.

## User Views (3)

| View | Actor | Key Features |
|------|-------|-------------|
| Customer View | Customer | Place order, track driver on map, ETA countdown, proximity notification |
| Driver View | Driver | See order assignment, accept/reject, update status (ACCEPTED→IN_TRANSIT→ARRIVING→DELIVERED) |
| Admin Dashboard | Admin | Speed alerts, proximity alerts, trip playback, driver analytics, heatmap |

## Phases

| # | Phase | Status | Effort | Link |
|---|-------|--------|--------|------|
| 1 | Project Setup | Pending | 1h | [phase-01](./phase-01-project-setup.md) |
| 2 | Live Tracking View | Pending | 4h | [phase-02-live-tracking.md) |
| 3 | WebSocket Integration | Pending | 3h | [phase-03-websocket.md) |
| 4 | Driver View | Pending | 3h | [phase-04-driver-view.md) |
| 5 | Admin Dashboard | Pending | 3h | [phase-05-admin-dashboard.md) |
| 6 | Polish & Demo | Pending | 2h | [phase-06-demo-ready.md) |

## Key Decisions

| Component | Choice |
|-----------|--------|
| Build | Vite + React + TypeScript |
| Map | react-leaflet + OpenStreetMap |
| State | Zustand (driver position + WebSocket state) |
| API State | TanStack Query (orders, trips, analytics) |
| Real-time | WebSocket hook (location + alerts) |

## Critical

**Marker updates via `useRef` + `setLatLng()`, NOT React state.** Every WebSocket message must call `marker.setLatLng()` imperatively. Putting position in React state causes marker DOM recreation → visible flicker.

## Research

- [Research Report](./research/researcher-01-frontend-report.md)
