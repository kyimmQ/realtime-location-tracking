import { AdminPage } from '../../features/admin/AdminPage';
import { useAuth } from '../../shared/hooks/useAuth';

export default function AdminDashboard() {
  const { logout } = useAuth();
  return (
    <div>
      <div style={{ padding: '1rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e5e7eb' }}>
        <h2>Admin Dashboard</h2>
        <button onClick={logout} style={{ padding: '0.5rem 1rem', background: '#ef4444', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
          Logout
        </button>
      </div>
      <AdminPage />
    </div>
  );
}
