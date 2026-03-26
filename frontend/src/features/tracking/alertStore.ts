import { create } from 'zustand';
import type { AlertMessage } from '../../shared/types';

interface AlertState {
  alerts: AlertMessage[];
  addAlert: (alert: AlertMessage) => void;
  clearAlerts: () => void;
}

export const useAlertStore = create<AlertState>((set) => ({
  alerts: [],
  addAlert: (alert) =>
    set((state) => ({
      alerts: [alert, ...state.alerts].slice(0, 10), // Keep the last 10 alerts
    })),
  clearAlerts: () => set({ alerts: [] }),
}));
