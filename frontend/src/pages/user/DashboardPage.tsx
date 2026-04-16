import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../shared/hooks/useAuth'

interface Order {
  id: string
  status: string
  driver_id: string | null
  restaurant_location: string
  delivery_location: string
  gpx_file: string
  created_at: string
}

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  PENDING:    { label: 'Pending',     bg: 'bg-yellow-50',   text: 'text-yellow-700', dot: 'bg-yellow-500' },
  ASSIGNED:   { label: 'Assigned',    bg: 'bg-blue-50',     text: 'text-blue-700',   dot: 'bg-blue-500' },
  ACCEPTED:   { label: 'Accepted',    bg: 'bg-purple-50',  text: 'text-purple-700', dot: 'bg-purple-500' },
  PICKED_UP:  { label: 'Picked Up',   bg: 'bg-orange-50',  text: 'text-orange-700', dot: 'bg-orange-500' },
  IN_TRANSIT: { label: 'In Transit', bg: 'bg-red-50',      text: 'text-red-700',    dot: 'bg-red-500' },
  ARRIVING:   { label: 'Arriving',    bg: 'bg-amber-50',   text: 'text-amber-700', dot: 'bg-amber-500' },
  DELIVERED:  { label: 'Delivered',   bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  CANCELLED:  { label: 'Cancelled',   bg: 'bg-surface-100', text: 'text-surface-500', dot: 'bg-surface-400' },
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export default function UserDashboard() {
  const { user, accessToken, logout } = useAuth()
  const navigate = useNavigate()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(false)
  const [placing, setPlacing] = useState(false)

  const fetchOrders = async () => {
    if (!accessToken) return
    setLoading(true)
    try {
      const res = await fetch('/api/orders', {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (res.ok) {
        const data = await res.json()
        setOrders(data)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchOrders() }, [accessToken])

  const placeOrder = async () => {
    if (!accessToken) return
    setPlacing(true)
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      })
      if (res.ok) {
        const order = await res.json()
        fetchOrders()
        navigate(`/track/${order.id}`)
      }
    } finally {
      setPlacing(false)
    }
  }

  const activeOrders = orders.filter(o => !['DELIVERED', 'CANCELLED'].includes(o.status))
  const pastOrders = orders.filter(o => ['DELIVERED', 'CANCELLED'].includes(o.status))

  return (
    <div className="min-h-screen bg-surface-base">

      {/* ── Top Navbar ─────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm shadow-navbar">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="h-16 flex items-center justify-between">
            {/* Brand */}
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl gradient-customer flex items-center justify-center shadow-ambient-orange">
                <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v3"/>
                  <rect x="9" y="11" width="14" height="10" rx="2"/>
                  <circle cx="12" cy="16" r="1"/>
                </svg>
              </div>
              <span className="font-headline text-lg font-bold text-surface-900 tracking-tight">Deshipping</span>
            </div>

            {/* User info */}
            <div className="flex items-center gap-4">
              <div className="hidden sm:block text-right">
                <p className="text-sm font-semibold text-surface-800 leading-tight">{user?.name || 'Customer'}</p>
                <p className="text-xs text-surface-500">{user?.email}</p>
              </div>
              <div className="w-9 h-9 rounded-full bg-brand-500 flex items-center justify-center text-white font-bold text-sm shadow-ambient-orange">
                {(user?.name || user?.email || 'U').charAt(0).toUpperCase()}
              </div>
              <button
                onClick={logout}
                className="btn btn-ghost btn-sm text-surface-500 hover:text-red-600"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                  <polyline points="16 17 21 12 16 7"/>
                  <line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* ── Hero CTA ──────────────────────────────────────────────── */}
        <div className="relative rounded-2xl overflow-hidden mb-8 animate-fade-in">
          {/* Kinetic gradient bar */}
          <div className="absolute inset-0 gradient-kinetic opacity-10"/>
          <div className="absolute inset-0 bg-gradient-to-br from-brand-500/5 via-transparent to-transparent"/>

          <div className="relative px-8 py-8 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div>
              <h1 className="text-2xl font-bold text-surface-900 font-headline tracking-tight">
                {activeOrders.length > 0
                  ? `You have ${activeOrders.length} active delivery${activeOrders.length > 1 ? 'ies' : 'y'}`
                  : 'Ready for your next delivery?'}
              </h1>
              <p className="text-surface-500 mt-1.5 text-sm">
                {activeOrders.length > 0
                  ? 'Track your orders in real-time, from pickup to destination'
                  : 'Place an order and track your driver live on the map'}
              </p>
            </div>

            <button
              onClick={placeOrder}
              disabled={placing}
              className="btn btn-primary btn-lg rounded-xl shadow-ambient-orange whitespace-nowrap animate-bounce-in"
              style={{animationDelay: '100ms'}}
            >
              {placing ? (
                <>
                  <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <circle cx="12" cy="12" r="10" strokeOpacity="0.3"/>
                    <path d="M12 2a10 10 0 0 1 10 10"/>
                  </svg>
                  Placing Order…
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19"/>
                    <line x1="5" y1="12" x2="19" y2="12"/>
                  </svg>
                  Place New Order
                </>
              )}
            </button>
          </div>
        </div>

        {/* ── Active Orders ─────────────────────────────────────────── */}
        {activeOrders.length > 0 && (
          <section className="mb-8 animate-slide-up" style={{animationDelay:'80ms'}}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="section-title mb-0">Active Deliveries</h2>
              <span className="badge badge-warning">{activeOrders.length} active</span>
            </div>

            <div className="space-y-3">
              {activeOrders.map((order, idx) => {
                const cfg = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.PENDING
                return (
                  <div
                    key={order.id}
                    onClick={() => navigate(`/track/${order.id}`)}
                    className="card cursor-pointer hover:shadow-card-hover transition-all duration-200 overflow-hidden group animate-slide-up"
                    style={{animationDelay: `${idx * 60}ms`}}
                  >
                    {/* Color accent bar */}
                    <div className={`h-1 bg-gradient-to-r ${order.status === 'IN_TRANSIT' ? 'from-red-400 to-red-600' : 'from-brand-400 to-brand-600'}`}/>

                    <div className="p-5">
                      <div className="flex items-start justify-between gap-4 mb-4">
                        <div>
                          <p className="text-xs font-mono font-semibold text-surface-400 uppercase tracking-wider">Order</p>
                          <p className="text-base font-bold text-surface-900 font-headline mt-0.5">
                            #{order.id.slice(0, 8).toUpperCase()}
                          </p>
                        </div>
                        <span className={`badge ${cfg.bg} ${cfg.text}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot} ${order.status === 'IN_TRANSIT' ? 'animate-pulse' : ''}`}/>
                          {cfg.label}
                        </span>
                      </div>

                      {/* Route visualization */}
                      <div className="flex items-start gap-3">
                        <div className="flex flex-col items-center mt-1">
                          <div className="w-3 h-3 rounded-full bg-emerald-400 ring-4 ring-emerald-100"/>
                          <div className="w-0.5 flex-1 bg-gradient-to-b from-surface-200 to-surface-100 my-1.5 min-h-[24px]"/>
                          <div className="w-3 h-3 rounded-full bg-red-400"/>
                        </div>
                        <div className="flex-1 space-y-4">
                          <div>
                            <p className="text-2xs font-semibold text-surface-400 uppercase tracking-wider">Pickup</p>
                            <p className="text-sm font-medium text-surface-700 mt-0.5">{order.restaurant_location}</p>
                          </div>
                          <div>
                            <p className="text-2xs font-semibold text-surface-400 uppercase tracking-wider">Dropoff</p>
                            <p className="text-sm font-medium text-surface-700 mt-0.5">{order.delivery_location}</p>
                          </div>
                        </div>
                      </div>

                      {/* Track CTA */}
                      <div className="mt-4 pt-4 border-t border-surface-100 flex items-center justify-between">
                        <span className="text-xs text-surface-400">{timeAgo(order.created_at)}</span>
                        <span className="text-sm font-semibold text-brand-600 group-hover:text-brand-700 flex items-center gap-1">
                          Track Order
                          <svg className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M5 12h14M12 5l7 7-7 7"/>
                          </svg>
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* ── Past Orders ───────────────────────────────────────────── */}
        {pastOrders.length > 0 && (
          <section className="animate-slide-up" style={{animationDelay:'160ms'}}>
            <h2 className="section-title">Delivery History</h2>
            <div className="space-y-2">
              {pastOrders.map((order, idx) => {
                const cfg = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.CANCELLED
                return (
                  <div
                    key={order.id}
                    onClick={() => navigate(`/track/${order.id}`)}
                    className="card-surface flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-surface-container-lowest transition-colors rounded-xl"
                    style={{animationDelay: `${idx * 40}ms`}}
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${order.status === 'DELIVERED' ? 'bg-emerald-50' : 'bg-surface-100'}`}>
                      {order.status === 'DELIVERED' ? (
                        <svg className="w-5 h-5 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                      ) : (
                        <svg className="w-5 h-5 text-surface-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10"/>
                          <line x1="15" y1="9" x2="9" y2="15"/>
                          <line x1="9" y1="9" x2="15" y2="15"/>
                        </svg>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-surface-800 font-headline">
                        #{order.id.slice(0, 8).toUpperCase()}
                      </p>
                      <p className="text-xs text-surface-500 mt-0.5 truncate">{order.delivery_location}</p>
                    </div>
                    <span className={`badge flex-shrink-0 ${cfg.bg} ${cfg.text}`}>{cfg.label}</span>
                    <span className="text-xs text-surface-400 flex-shrink-0">{timeAgo(order.created_at)}</span>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* ── Empty state ────────────────────────────────────────────── */}
        {!loading && orders.length === 0 && (
          <div className="text-center py-20 animate-fade-in">
            <div className="w-20 h-20 rounded-2xl bg-surface-container flex items-center justify-center mx-auto mb-5 shadow-ambient-orange">
              <svg className="w-10 h-10 text-brand-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="1" y="3" width="15" height="13"/>
                <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/>
                <circle cx="5.5" cy="18.5" r="2.5"/>
                <circle cx="18.5" cy="18.5" r="2.5"/>
              </svg>
            </div>
            <h3 className="text-lg font-bold text-surface-800 font-headline mb-2">No orders yet</h3>
            <p className="text-sm text-surface-500 max-w-xs mx-auto mb-6">
              Place your first delivery order and track it live from pickup to your door.
            </p>
            <button
              onClick={placeOrder}
              disabled={placing}
              className="btn btn-primary btn-lg rounded-xl"
            >
              {placing ? 'Placing Order…' : 'Place Your First Order'}
            </button>
          </div>
        )}

        {loading && (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="card p-5 animate-pulse">
                <div className="flex items-center justify-between mb-4">
                  <div className="h-4 bg-surface-100 rounded w-24"/>
                  <div className="h-5 bg-surface-100 rounded-full w-20"/>
                </div>
                <div className="space-y-2">
                  <div className="h-3 bg-surface-50 rounded w-3/4"/>
                  <div className="h-3 bg-surface-50 rounded w-1/2"/>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <div className="h-8"/>
    </div>
  )
}
