import { create } from 'zustand';

interface TrackingState {
  driverPosition: { lat: number; lng: number } | null;
  driverId: string | null;
  etaSeconds: number;
  distanceKm: number;
  speed: number;
  traveledPath: [number, number][];
  setPosition: (lat: number, lng: number) => void;
  setDriverId: (driverId: string) => void;
  update: (update: Partial<{ etaSeconds: number; distanceKm: number; speed: number }>) => void;
  addPathPoint: (lat: number, lng: number) => void;
}

export const useTrackingStore = create<TrackingState>((set) => ({
  driverPosition: null,
  driverId: null,
  etaSeconds: 0,
  distanceKm: 0,
  speed: 0,
  traveledPath: [],

  setPosition: (lat, lng) => set({ driverPosition: { lat, lng } }),

  setDriverId: (driverId) => set({ driverId }),

  update: (update) => set((s) => ({ ...s, ...update })),

  addPathPoint: (lat, lng) =>
    set((s) => ({ traveledPath: [...s.traveledPath, [lat, lng]] })),
}));
