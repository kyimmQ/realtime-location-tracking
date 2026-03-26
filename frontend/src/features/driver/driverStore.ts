import { create } from 'zustand';
import type { Order } from '../../shared/types';

interface DriverState {
  currentOrder: Order | null;
  status: 'idle' | 'waiting' | 'assigned' | 'accepted' | 'picking_up' | 'in_transit' | 'arriving' | 'delivered';
  setOrder: (order: Order) => void;
  updateStatus: (status: DriverState['status']) => void;
  clearOrder: () => void;
}

export const useDriverStore = create<DriverState>((set) => ({
  currentOrder: null,
  status: 'idle',
  setOrder: (order) => set({ currentOrder: order, status: 'assigned' }),
  updateStatus: (status) => set({ status }),
  clearOrder: () => set({ currentOrder: null, status: 'idle' }),
}));
