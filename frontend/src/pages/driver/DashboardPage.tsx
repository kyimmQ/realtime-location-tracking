import { useEffect, useState } from 'react';
import { useAuth } from '../../shared/hooks/useAuth';
import { DriverPage } from '../../features/driver/DriverPage';

interface ActiveOrder {
  id: string;
  status: string;
  user_id: string;
  restaurant_location: string;
  delivery_location: string;
}

export default function DriverDashboard() {
  const { user, accessToken, logout } = useAuth();
  const [activeOrder, setActiveOrder] = useState<ActiveOrder | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    const fetchActive = async () => {
      const res = await fetch('/api/orders', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) {
        const orders = await res.json();
        const active = orders.find(
          (o: ActiveOrder) => o.status !== 'DELIVERED' && o.status !== 'CANCELLED' && o.status !== 'PENDING'
        );
        setActiveOrder(active || null);
      }
    };
    fetchActive();
    const interval = setInterval(fetchActive, 5000);
    return () => clearInterval(interval);
  }, [accessToken]);

  if (activeOrder && (activeOrder.status === 'IN_TRANSIT' || activeOrder.status === 'ACCEPTED' || activeOrder.status === 'PICKING_UP' || activeOrder.status === 'ARRIVING')) {
    return (
      <div>
        <div style={{ padding: '1rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e5e7eb' }}>
          <h2>Active Delivery</h2>
          <button onClick={logout} style={{ padding: '0.5rem 1rem', background: '#ef4444', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
            Logout
          </button>
        </div>
        <DriverPage embedded orderId={activeOrder.id} onStatusUpdate={() => {
          // Refresh active order on status update
          fetch('/api/orders', { headers: { Authorization: `Bearer ${accessToken}` } })
            .then(r => r.json())
            .then(orders => {
              const active = orders.find(
                (o: ActiveOrder) => o.status !== 'DELIVERED' && o.status !== 'CANCELLED' && o.status !== 'PENDING'
              );
              setActiveOrder(active || null);
            });
        }} />
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1>Driver Dashboard</h1>
          <p style={{ color: '#666' }}>{user?.name || user?.email}</p>
        </div>
        <button onClick={logout} style={{ padding: '0.5rem 1rem', background: '#ef4444', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
          Logout
        </button>
      </div>
      <DriverPage />
    </div>
  );
}
