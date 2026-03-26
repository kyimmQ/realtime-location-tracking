---
title: "Phase 1: Project Setup"
description: "Vite + React + TypeScript project with dependencies"
status: pending
priority: P1
effort: 1h
branch: main
tags: [frontend, react, typescript, vite]
created: 2026-03-26
---

# Phase 1: Project Setup

## Context Links

- Parent: [plan.md](./plan.md)
- Spec: `SPECIFICATION.md` (Frontend)

## Overview

| Field | Value |
|-------|-------|
| Priority | P1 |
| Status | Pending |
| Effort | 1h |

## Requirements

### Install

```bash
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install react-leaflet leaflet @types/leaflet
npm install zustand
```

### Project Structure

```
frontend/src/
├── features/
│   └── tracking/
│       ├── TrackingPage.tsx      # Main tracking page
│       ├── TrackingMap.tsx       # Map with driver marker
│       └── trackingStore.ts      # Zustand store
├── shared/
│   ├── hooks/
│   │   └── useWebSocket.ts      # WS hook
│   └── types/
│       └── index.ts             # Shared types
├── App.tsx
├── main.tsx
└── index.css
```

## Todo List

- [ ] `npm create vite@latest frontend -- --template react-ts`
- [ ] Install react-leaflet, leaflet, zustand
- [ ] Create basic structure
- [ ] Verify `npm run dev` works
- [ ] Add marker icon SVGs to public/

## Success Criteria

- `npm run dev` starts at localhost:5173
- `npm run build` produces no errors
