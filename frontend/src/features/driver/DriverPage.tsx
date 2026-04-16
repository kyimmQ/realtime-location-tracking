import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useDriverStore } from './driverStore'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import type { Order } from '../../shared/types'
import { useAuth } from '../../shared/hooks/useAuth'
import { useEffect } from 'react'

const STATUS_CONFIG: Record<string, { label: string; color: string; dot: string; bg: string }> = {
  idle:        { label: 'Online — Waiting',      color: 'bg-surface-100 text-surface-500',    dot: 'bg-surface-400', bg: 'bg-surface-50' },
  assigned:    { label: 'New Order Assigned',   color: 'bg-yellow-50 text-yellow-700',       dot: 'bg-yellow-500', bg: 'bg-yellow-50' },
  accepted:    { label: 'Heading to Restaurant', color: 'bg-blue-50 text-blue-700',          dot: 'bg-blue-500', bg: 'bg-blue-50' },
  picking_up:  { label: 'Picking Up Order',       color: 'bg-orange-50 text-orange-700',       dot: 'bg-orange-500', bg: 'bg-orange-50' },
  in_transit:  { label: 'En Route to Customer',  color: 'bg-red-50 text-red-700',            dot: 'bg-red-500', bg: 'bg-red-50' },
  arriving:    { label: 'Arriving at Destination', color: 'bg-purple-50 text-purple-700',   dot: 'bg-purple-500', bg: 'bg-purple-50' },
  delivered:  { label: 'Delivery Complete',       color: 'bg-emerald-50 text-emerald-700',     dot: 'bg-emerald-500', bg: 'bg-emerald-50' },
}

const NEXT_STATUS = {
  assigned:    { label: 'Accept Order',         next: 'ACCEPTED',   variant: 'primary' as const },
  accepted:    { label: 'Start Picking Up',    next: 'PICKING_UP',  variant: 'primary' as const },
  picking_up:  { label: 'Start Delivery',       next: 'IN_TRANSIT',  variant: 'primary' as const },
  in_transit:  { label: 'Mark Arriving',        next: 'ARRIVING',    variant: 'primary' as const },
  arriving:    { label: 'Mark Delivered',        next: 'DELIVERED',   variant: 'primary' as const },
}

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080'

interface DriverPageProps {
  embedded?: boolean
  orderId?: string
  onStatusUpdate?: () => void
}

export function DriverPage({ embedded, orderId, onStatusUpdate }: DriverPageProps) {
  const { accessToken, user } = useAuth()
  const { currentOrder, status, setOrder, updateStatus, clearOrder } = useDriverStore()
  const queryClient = useQueryClient()

  const authHeaders: Record<string, string> = accessToken ? { Authorization: `Bearer ${accessToken}` } : {}

  // Fetch specific order when embedded
  const { data: embeddedOrder } = useQuery<Order | null>({
    queryKey: ['order', orderId],
    queryFn: async () => {
      if (!orderId) return null
      const r = await fetch(`${API_BASE}/api/orders/${orderId}`, { headers: authHeaders })
      if (!r.ok) return null
      return r.json()
    },
    enabled: !!embedded && !!orderId,
  })

  // Set embedded order in store
  useEffect(() => {
    if (embedded && embeddedOrder && !currentOrder) {
      setOrder(embeddedOrder)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [embedded, embeddedOrder])

  // Poll for new orders (only when not embedded)
  const { data: orders = [], isLoading, refetch } = useQuery<Order[]>({
    queryKey: ['orders', 'driver', accessToken],
    queryFn: async () => {
      const r = await fetch(`${API_BASE}/api/orders`, { headers: authHeaders })
      if (!r.ok) throw new Error('Network error')
      return r.json()
    },
    refetchInterval: embedded ? false : 3000,
    staleTime: 0,
    retry: 1,
    enabled: !embedded,
  })

  // Force refetch when component mounts
  useEffect(() => {
    refetch()
  }, [refetch])

  // Accept order
  const acceptMutation = useMutation({
    mutationFn: (id: string) =>
      fetch(`${API_BASE}/api/orders/${id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ status: 'ACCEPTED' }),
      }).then(r => r.json()),
    onSuccess: (_data: unknown, id: string) => {
      const acceptedOrder = orders.find((o: Order) => o.id === id)
      if (acceptedOrder) {
        setOrder(acceptedOrder)
      }
      updateStatus('accepted')
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      onStatusUpdate?.()
    },
  })

  // Status update
  const statusMutation = useMutation({
    mutationFn: ({ id, newStatus }: { id: string; newStatus: string }) =>
      fetch(`${API_BASE}/api/orders/${id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ status: newStatus }),
      }).then(r => r.ok ? r.json() : { id, status: newStatus } as { id: string; status: string }),
    onSuccess: (data: { id: string; status: string }) => {
      const orderStatus = data.status
      updateStatus(orderStatus.toLowerCase() as typeof status)
      if (orderStatus === 'DELIVERED') {
        clearOrder()
      }
      onStatusUpdate?.()
    },
  })

  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.idle
  const pendingOrders = embedded ? [] : orders.filter((o) => o.status === 'PENDING' || o.status === 'ASSIGNED')
  const canAccept = NEXT_STATUS[status as keyof typeof NEXT_STATUS]
  const activeOrder = embedded && embeddedOrder ? embeddedOrder : currentOrder

  const DRIVER_NAV = [
    { label: 'Home', icon: <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>, active: true },
    { label: 'My Orders', icon: <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v3"/><rect x="9" y="11" width="14" height="10" rx="2"/></svg>, active: false },
    { label: 'Earnings', icon: <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>, active: false },
    { label: 'Profile', icon: <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>, active: false },
  ]

  return (
    <div className="flex h-screen overflow-hidden bg-surface-50">
      {/* ── Dark Sidebar ──────────────────────────────────────────── */}
      <aside className="w-60 bg-[#191b23] text-white flex flex-col flex-shrink-0">

        {/* Logo + Driver */}
        <div className="px-4 pt-5 pb-4 border-b border-white/10">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-driver-500 flex items-center justify-center flex-shrink-0 shadow-glow-blue">
              <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="1" y="3" width="15" height="13"/>
                <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/>
                <circle cx="5.5" cy="18.5" r="2.5"/>
                <circle cx="18.5" cy="18.5" r="2.5"/>
              </svg>
            </div>
            <div className="overflow-hidden">
              <p className="font-semibold text-sm text-white truncate">{user?.name || 'Driver'}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"/>
                <span className="text-xs text-white/40">Online</span>
              </div>
            </div>
          </div>

          {/* Online toggle pill */}
          <div className="flex items-center justify-between bg-white/5 border border-white/10 rounded-xl px-3 py-2">
            <span className="text-xs text-white/50">Status</span>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"/>
              <span className="text-xs font-semibold text-emerald-400 capitalize">{status === 'idle' ? 'Online' : 'Busy'}</span>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 px-3 space-y-1">
          {DRIVER_NAV.map(item => (
            <button
              key={item.label}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                item.active
                  ? 'bg-driver-500/20 text-driver-400 border border-driver-500/30'
                  : 'text-white/50 hover:text-white hover:bg-white/5 border border-transparent'
              }`}
            >
              <span className={item.active ? 'text-driver-400' : 'text-white/30'}>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        {/* Bottom */}
        <div className="p-3 border-t border-white/10 space-y-1">
          <div className="px-3 py-2 flex items-center gap-3 text-white/30 text-xs">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 16 14"/>
            </svg>
            <span>Shift: 8h 24m</span>
          </div>
        </div>
      </aside>

      {/* ── Main Content ─────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">

          {/* ── Status Banner ─────────────────────────────────────────── */}
          <div className={`${cfg.color} rounded-2xl p-4 flex items-center gap-3 mb-6 animate-bounce-in`}>
            <div className={`w-3 h-3 rounded-full ${cfg.dot} ${status !== 'idle' ? 'animate-pulse' : ''}`}/>
            <span className="font-semibold text-sm">{cfg.label}</span>
            {activeOrder && (
              <span className="ml-auto text-xs font-mono text-surface-500">
                #{activeOrder.id.slice(0, 8).toUpperCase()}
              </span>
            )}
          </div>

          {/* ── Pending Orders ──────────────────────────────────────── */}
          {status === 'idle' && !embedded && (
            <div className="space-y-3 animate-fade-in">
              <h2 className="section-title">Available Orders</h2>

              {isLoading ? (
                <div className="space-y-3">
                  {[1, 2].map(i => (
                    <div key={i} className="bg-white rounded-xl border border-surface-100 p-4 animate-pulse">
                      <div className="h-4 bg-surface-100 rounded w-1/2 mb-3"/>
                      <div className="h-3 bg-surface-50 rounded w-3/4 mb-2"/>
                      <div className="h-3 bg-surface-50 rounded w-2/3"/>
                    </div>
                  ))}
                </div>
              ) : pendingOrders.length === 0 ? (
                <div className="card-body text-center py-12">
                  <div className="w-14 h-14 rounded-2xl bg-surface-100 flex items-center justify-center mx-auto mb-4">
                    <svg className="w-7 h-7 text-surface-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v3"/>
                      <rect x="9" y="11" width="14" height="10" rx="2"/>
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-surface-600">No orders right now</p>
                  <p className="text-xs text-surface-400 mt-1">New orders will appear automatically</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingOrders.map((order: Order) => (
                    <div key={order.id} className="card border border-surface-100 rounded-xl overflow-hidden">
                      {/* Blue accent bar */}
                      <div className="h-1 bg-gradient-to-r from-driver-400 to-driver-600"/>

                      <div className="px-4 pt-4 pb-3">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <p className="text-xs font-medium text-surface-500 uppercase tracking-wider">Order</p>
                            <p className="text-base font-bold text-surface-900 font-headline mt-0.5">
                              #{order.id.slice(0, 8).toUpperCase()}
                            </p>
                          </div>
                          <Badge variant="warning">New</Badge>
                        </div>

                        {/* Route */}
                        <div className="flex items-start gap-3 mb-4">
                          <div className="flex flex-col items-center mt-1">
                            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400"/>
                            <div className="w-0.5 flex-1 bg-gradient-to-b from-surface-200 to-transparent my-1 min-h-[20px]"/>
                            <div className="w-2.5 h-2.5 rounded-full bg-red-400"/>
                          </div>
                          <div className="flex-1 space-y-3">
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

                        <Button
                          variant="primary"
                          size="lg"
                          className="w-full !rounded-xl bg-driver-500 hover:bg-driver-600 active:bg-driver-700"
                          loading={acceptMutation.isPending}
                          onClick={() => acceptMutation.mutate(order.id)}
                        >
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12"/>
                          </svg>
                          Accept Order
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Active Order Card ────────────────────────────────────── */}
          {activeOrder && status !== 'idle' && (
            <div className="space-y-3 animate-slide-up">
              <div className="card border border-driver-100 rounded-xl overflow-hidden">
                {/* Driver-blue header */}
                <div className="px-5 pt-4 pb-3 bg-driver-50 border-b border-driver-100 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-driver-600 uppercase tracking-wider">Active Order</p>
                    <p className="text-lg font-bold text-driver-800 font-headline mt-0.5">
                      #{activeOrder.id.slice(0, 8).toUpperCase()}
                    </p>
                  </div>
                  <div className="text-right">
                    <Badge variant="info" dot>Active</Badge>
                    <p className="text-xs text-driver-500 mt-1 capitalize">{status.replace('_', ' ')}</p>
                  </div>
                </div>

                <div className="p-5 space-y-5">
                  {/* Route visualization */}
                  <div className="flex items-start gap-3">
                    <div className="flex flex-col items-center mt-1">
                      <div className="w-3 h-3 rounded-full bg-emerald-400 ring-4 ring-emerald-100"/>
                      <div className="w-0.5 flex-1 bg-surface-200 my-1"/>
                      <div className="w-3 h-3 rounded-full bg-red-400"/>
                    </div>
                    <div className="flex-1">
                      <div className="mb-4">
                        <p className="text-2xs font-semibold text-surface-400 uppercase tracking-wider">Pickup</p>
                        <p className="text-sm font-medium text-surface-700 mt-0.5">{activeOrder.restaurant_location}</p>
                      </div>
                      <div>
                        <p className="text-2xs font-semibold text-surface-400 uppercase tracking-wider">Dropoff</p>
                        <p className="text-sm font-medium text-surface-700 mt-0.5">{activeOrder.delivery_location}</p>
                      </div>
                    </div>
                  </div>

                  <div className="divider"/>

                  {/* Next action button */}
                  {canAccept && (
                    <Button
                      variant={canAccept.variant}
                      size="lg"
                      className="w-full !rounded-xl bg-driver-500 hover:bg-driver-600 active:bg-driver-700"
                      loading={statusMutation.isPending}
                      onClick={() => statusMutation.mutate({
                        id: activeOrder.id,
                        newStatus: canAccept.next,
                      })}
                    >
                      {status === 'accepted' && (
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                          <circle cx="12" cy="10" r="3"/>
                        </svg>
                      )}
                      {status === 'picking_up' && (
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="1" y="3" width="15" height="13"/>
                          <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/>
                          <circle cx="5.5" cy="18.5" r="2.5"/>
                          <circle cx="18.5" cy="18.5" r="2.5"/>
                        </svg>
                      )}
                      {status === 'in_transit' && (
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10"/>
                          <path d="M12 8v4l3 3"/>
                        </svg>
                      )}
                      {status === 'arriving' && (
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                      )}
                      {canAccept.label}
                    </Button>
                  )}

                  {status === 'delivered' && (
                    <div className="text-center py-3">
                      <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-3">
                        <svg className="w-7 h-7 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                      </div>
                      <p className="text-base font-bold text-emerald-700">Delivery Complete!</p>
                      <p className="text-sm text-emerald-600/80 mt-1">Great work. You're ready for the next order.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="h-8"/>
        </div>
      </div>
    </div>
  )
}
