---
title: "Phase 4: Driver View"
description: "Driver app: view order assignment, accept/reject, update delivery status"
status: pending
priority: P1
effort: 3h
branch: main
tags: [frontend, react]
created: 2026-03-26
---

# Phase 4: Driver View

## Context Links

- Parent: [plan.md](./plan.md)
- Depends on: [Phase 1](./phase-01-project-setup.md)
- Spec: `SPECIFICATION.md` (Driver User Story §2.2)

## Overview

| Field | Value |
|-------|-------|
| Priority | P1 |
| Status | Pending |
| Effort | 3h |

Driver app: view incoming order, accept/reject, update delivery status through lifecycle.

## Order Status Lifecycle

```
PENDING → ACCEPTED → PICKING_UP → IN_TRANSIT → ARRIVING → DELIVERED
```

## Components

### `src/features/driver/driverStore.ts`

```typescript
import { create } from 'zustand';

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
```

### `src/features/driver/DriverPage.tsx`

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useDriverStore } from './driverStore';

export function DriverPage() {
  const { currentOrder, status, setOrder, updateStatus, clearOrder } = useDriverStore();
  const queryClient = useQueryClient();

  // Poll for new orders
  const { data: orders = [] } = useQuery({
    queryKey: ['orders', 'driver', 'D001'],
    queryFn: () => fetch('/api/orders?driver_id=D001').then(r => r.json()),
    refInterval: 5000, // poll every 5s
  });

  // Accept order mutation
  const acceptMutation = useMutation({
    mutationFn: (orderId: string) =>
      fetch(`/api/orders/${orderId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'ACCEPTED' }),
      }).then(r => r.json()),
    onSuccess: (data) => {
      setOrder(data);
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });

  // Status update mutation
  const statusMutation = useMutation({
    mutationFn: ({ orderId, status }: { orderId: string; status: string }) =>
      fetch(`/api/orders/${orderId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      }).then(r => r.json()),
    onSuccess: (data) => {
      updateStatus(data.status);
      if (data.status === 'DELIVERED') {
        clearOrder();
      }
    },
  });

  const nextStatus = {
    accepted: { label: 'Start Picking Up', next: 'PICKING_UP' },
    picking_up: { label: 'Start Delivery', next: 'IN_TRANSIT' },
    in_transit: { label: 'Mark Arriving', next: 'ARRIVING' },
    arriving: { label: 'Mark Delivered', next: 'DELIVERED' },
  };

  return (
    <div className="max-w-md mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Driver App</h1>

      {/* Status indicator */}
      <div className={`px-4 py-2 rounded mb-4 text-center font-bold
        ${status === 'idle' ? 'bg-gray-200 text-gray-600' :
          status === 'assigned' ? 'bg-yellow-100 text-yellow-800' :
          'bg-green-100 text-green-800'}`}>
        {status === 'idle' && '🟢 Waiting for orders...'}
        {status === 'assigned' && '🟡 New order assigned!'}
        {status === 'accepted' && '🔵 Heading to restaurant'}
        {status === 'picking_up' && '🟠 Picking up order'}
        {status === 'in_transit' && '🔴 En route to customer'}
        {status === 'arriving' && '🟣 Arriving at destination'}
        {status === 'delivered' && '✅ Delivered'}
      </div>

      {/* Pending orders list */}
      {status === 'idle' && orders.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Available Orders</h2>
          {orders.map(order => (
            <div key={order.order_id} className="border rounded p-4 shadow">
              <p className="font-medium">Order #{order.order_id.slice(0,8)}</p>
              <p className="text-gray-600 text-sm">From: {order.restaurant_location}</p>
              <p className="text-gray-600 text-sm">To: {order.delivery_location}</p>
              <button
                onClick={() => acceptMutation.mutate(order.order_id)}
                className="mt-2 w-full bg-green-600 text-white py-2 rounded hover:bg-green-700"
              >
                Accept Order
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Active order card */}
      {currentOrder && status !== 'idle' && (
        <div className="border rounded p-4 shadow">
          <h2 className="text-lg font-bold">Active Order</h2>
          <p className="text-gray-600">Order #{currentOrder.order_id.slice(0,8)}</p>
          <p className="text-gray-600 text-sm">Status: {status}</p>

          {/* Next status button */}
          {nextStatus[status as keyof typeof nextStatus] && (
            <button
              onClick={() => statusMutation.mutate({
                orderId: currentOrder.order_id,
                status: nextStatus[status as keyof typeof nextStatus].next,
              })}
              className="mt-4 w-full bg-blue-600 text-white py-3 rounded font-bold hover:bg-blue-700"
            >
              {nextStatus[status as keyof typeof nextStatus].label}
            </button>
          )}

          {/* Reject (only in assigned state) */}
          {status === 'assigned' && (
            <button
              onClick={() => clearOrder()}
              className="mt-2 w-full border border-red-600 text-red-600 py-2 rounded"
            >
              Reject Order
            </button>
          )}
        </div>
      )}
    </div>
  );
}
```

## Todo List

- [ ] Driver store (Zustand)
- [ ] DriverPage component
- [ ] Order list query (TanStack Query)
- [ ] Accept/reject mutations
- [ ] Status update mutations
- [ ] Basic styling

## Success Criteria

- Driver sees incoming orders when polling
- Accepting order → status changes to ACCEPTED
- Status update buttons progress through: PICKING_UP → IN_TRANSIT → ARRIVING → DELIVERED
- After DELIVERED → order clears, back to idle
