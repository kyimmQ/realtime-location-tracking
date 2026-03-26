import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useDriverStore } from './driverStore';
import type { Order } from '../../shared/types';

export function DriverPage() {
  const { currentOrder, status, setOrder, updateStatus, clearOrder } = useDriverStore();
  const queryClient = useQueryClient();

  // Poll for new orders
  const { data: orders = [] } = useQuery<Order[]>({
    queryKey: ['orders', 'driver', 'D001'],
    queryFn: () => fetch('/api/orders?driver_id=D001')
      .then(r => {
        if (!r.ok) {
           // Mocking an order if API doesn't exist yet for academic PoC
           if (r.status === 404) {
             return [{
               order_id: 'O789',
               customer_id: 'C123',
               driver_id: 'D001',
               restaurant_location: '10.762622,106.660172',
               delivery_location: '10.772622,106.670172',
               status: 'PENDING'
             }];
           }
           throw new Error('Network response was not ok');
        }
        return r.json();
      }).catch(() => {
        // Fallback for missing api
        return [{
          order_id: 'O789',
          customer_id: 'C123',
          driver_id: 'D001',
          restaurant_location: '10.762622,106.660172',
          delivery_location: '10.772622,106.670172',
          status: 'PENDING'
        }];
      }),
    refetchInterval: 5000, // poll every 5s
  });

  // Accept order mutation
  const acceptMutation = useMutation({
    mutationFn: (orderId: string) =>
      fetch(`/api/orders/${orderId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'ACCEPTED' }),
      }).then(r => {
        if (!r.ok) {
          // Mock success for PoC
          return {
            order_id: orderId,
            status: 'ACCEPTED'
          } as Order;
        }
        return r.json();
      }).catch(() => {
        const order = orders.find(o => o.order_id === orderId);
        return { ...order, status: 'ACCEPTED' } as Order;
      }),
    onSuccess: (data: Order) => {
      setOrder(data);
      updateStatus('accepted');
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });

  // Status update mutation
  const statusMutation = useMutation({
    mutationFn: ({ orderId, newStatus }: { orderId: string; newStatus: string }) =>
      fetch(`/api/orders/${orderId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: newStatus }),
      }).then(r => {
        if (!r.ok) {
           // Mock success for PoC
           return {
             order_id: orderId,
             status: newStatus
           } as Order;
        }
        return r.json();
      }).catch(() => {
        return {
          order_id: orderId,
          status: newStatus
        } as Order;
      }),
    onSuccess: (data: Order) => {
      updateStatus(data.status.toLowerCase() as typeof status);
      if (data.status === 'DELIVERED' || data.status === 'delivered') {
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
                newStatus: nextStatus[status as keyof typeof nextStatus].next,
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
