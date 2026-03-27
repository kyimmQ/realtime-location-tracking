import { create } from 'zustand';

interface Alert {
  alert_id: string;
  alert_type: 'SPEEDING' | 'PROXIMITY';
  driver_id: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  message: string;
  timestamp: string;
  metadata?: Record<string, string>;
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
