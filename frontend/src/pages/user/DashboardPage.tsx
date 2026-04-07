import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../shared/hooks/useAuth';

interface Order {
  id: string;
  status: string;
  driver_id: string | null;
  restaurant_location: string;
  delivery_location: string;
  gpx_file: string;
  created_at: string;
}

export default function UserDashboard() {
  const { user, accessToken, logout } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [placing, setPlacing] = useState(false);

  const fetchOrders = async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const res = await fetch('/api/orders', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setOrders(data);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchOrders(); }, [accessToken]);

  const placeOrder = async () => {
    if (!accessToken) return;
    setPlacing(true);
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });
      if (res.ok) {
        const order = await res.json();
        fetchOrders();
        navigate(`/track/${order.id}`);
      }
    } finally {
      setPlacing(false);
    }
  };

  const statusColor = (status: string) => {
    const map: Record<string, string> = {
      PENDING: '#f59e0b', ASSIGNED: '#3b82f6', ACCEPTED: '#8b5cf6',
      PICKED_UP: '#ec4899', IN_TRANSIT: '#06b6d4', ARRIVING: '#f97316',
      DELIVERED: '#22c55e', CANCELLED: '#ef4444',
    };
    return map[status] || '#666';
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1>Welcome, {user?.name || user?.email}</h1>
          <p style={{ color: '#666' }}>User Dashboard</p>
        </div>
        <button onClick={logout} style={{ padding: '0.5rem 1rem', background: '#ef4444', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
          Logout
        </button>
      </div>

      <div style={{ marginBottom: '2rem' }}>
        <button
          onClick={placeOrder}
          disabled={placing}
          style={{
            padding: '1rem 2rem',
            background: placing ? '#9ca3af' : '#22c55e',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '1.1rem',
            fontWeight: '600',
            cursor: placing ? 'not-allowed' : 'pointer',
          }}
        >
          {placing ? 'Placing Order...' : 'Place New Order'}
        </button>
      </div>

      <h2 style={{ marginBottom: '1rem' }}>Your Orders</h2>
      {loading ? <p>Loading...</p> : orders.length === 0 ? (
        <p style={{ color: '#999' }}>No orders yet. Place your first order!</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {orders.map(order => (
            <div
              key={order.id}
              onClick={() => navigate(`/track/${order.id}`)}
              style={{
                padding: '1rem',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <div style={{ fontFamily: 'monospace', fontSize: '0.85rem', color: '#666' }}>
                  {order.id.slice(0, 8)}...
                </div>
                <div style={{ fontSize: '0.9rem', marginTop: '0.25rem' }}>
                  {order.restaurant_location} → {order.delivery_location}
                </div>
              </div>
              <span style={{
                padding: '0.25rem 0.75rem',
                borderRadius: '999px',
                background: statusColor(order.status),
                color: 'white',
                fontSize: '0.8rem',
                fontWeight: '600',
              }}>
                {order.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
