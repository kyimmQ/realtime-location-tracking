import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useDriverStore } from './driverStore'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import type { Order } from '../../shared/types'
import { useAuth } from '../../shared/hooks/useAuth'
import { useEffect } from 'react'

const STATUS_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  idle:        { label: 'Online — Waiting',      color: 'bg-surface-100 text-surface-500',    dot: 'bg-surface-400' },
  assigned:    { label: 'New Order Assigned',   color: 'bg-yellow-50 text-yellow-700',       dot: 'bg-yellow-500' },
  accepted:    { label: 'Heading to Restaurant', color: 'bg-blue-50 text-blue-700',          dot: 'bg-blue-500' },
  picking_up:  { label: 'Picking Up Order',       color: 'bg-orange-50 text-orange-700',       dot: 'bg-orange-500' },
  in_transit:  { label: 'En Route to Customer',  color: 'bg-red-50 text-red-700',            dot: 'bg-red-500' },
  arriving:    { label: 'Arriving at Destination', color: 'bg-purple-50 text-purple-700',   dot: 'bg-purple-500' },
  delivered:   { label: 'Delivery Complete',     color: 'bg-emerald-50 text-emerald-700',     dot: 'bg-emerald-500' },
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
  const { accessToken } = useAuth()
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
    onSuccess: (_data: any, id: string) => {
      // API returns {status: "ACCEPTED"} - find the accepted order from the orders list
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
      }).then(r => r.ok ? r.json() : { id, status: newStatus } as any),
    onSuccess: (data: any) => {
      const orderStatus = data.status as string
      updateStatus(orderStatus.toLowerCase() as typeof status)
      if (orderStatus === 'DELIVERED') {
        clearOrder()
      }
      onStatusUpdate?.()
    },
  })

  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.idle
  // Show PENDING orders (available to all) and ASSIGNED orders (assigned to this driver)
  const pendingOrders = embedded ? [] : orders.filter((o) => o.status === 'PENDING' || o.status === 'ASSIGNED')
  console.log('[DEBUG] orders count:', orders.length, 'pendingOrders count:', pendingOrders.length, 'status:', status)
  const canAccept = NEXT_STATUS[status as keyof typeof NEXT_STATUS]
  const activeOrder = embedded && embeddedOrder ? embeddedOrder : currentOrder

  return (
    <div className="page-container max-w-md mx-auto flex flex-col gap-5">

      {/* ── Status Banner ─────────────────────────────────────────────── */}
      <div className={`${cfg.color} rounded-2xl p-4 flex items-center gap-3 animate-bounce-in`}>
        <div className={`w-3 h-3 rounded-full ${cfg.dot} ${status !== 'idle' ? 'animate-pulse' : ''}`}/>
        <span className="font-semibold text-sm">{cfg.label}</span>
      </div>

      {/* ── Pending Orders ────────────────────────────────────────────── */}
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
            <div className="card-body text-center py-10">
              <div className="w-12 h-12 rounded-xl bg-surface-100 flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-surface-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v3"/>
                  <rect x="9" y="11" width="14" height="10" rx="2"/>
                </svg>
              </div>
              <p className="text-sm font-medium text-surface-600">No orders right now</p>
              <p className="text-xs text-surface-400 mt-1">New orders will appear automatically</p>
            </div>
          ) : (
            pendingOrders.map((order: Order) => (
              <div key={order.id} className="card border border-surface-100 rounded-xl overflow-hidden">
                <div className="px-4 pt-4 pb-3">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="text-xs font-medium text-surface-500 uppercase tracking-wider">Order</p>
                      <p className="text-base font-bold text-surface-900 mt-0.5">#{order.id.slice(0,8).toUpperCase()}</p>
                    </div>
                    <Badge variant="warning">New</Badge>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-start gap-2.5">
                      <div className="mt-1.5 w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0"/>
                      <div>
                        <p className="text-xs text-surface-400">Pickup</p>
                        <p className="text-sm font-medium text-surface-700">{order.restaurant_location}</p>
                      </div>
                    </div>
                    <div className="ml-1 border-l-2 border-dashed border-surface-200 h-4"/>
                    <div className="flex items-start gap-2.5">
                      <div className="mt-1.5 w-2 h-2 rounded-full bg-red-400 flex-shrink-0"/>
                      <div>
                        <p className="text-xs text-surface-400">Dropoff</p>
                        <p className="text-sm font-medium text-surface-700">{order.delivery_location}</p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="px-4 pb-4">
                  <Button
                    variant="primary"
                    size="lg"
                    className="w-full !rounded-xl"
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
            ))
          )}
        </div>
      )}

      {/* ── Active Order Card ───────────────────────────────────────────── */}
      {activeOrder && status !== 'idle' && (
        <div className="space-y-3 animate-slide-up">
          <div className="card border border-driver-100 rounded-xl overflow-hidden">
            <div className="px-4 pt-4 pb-3 bg-driver-50 border-b border-driver-100 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-driver-600 uppercase tracking-wider">Active Order</p>
                <p className="text-lg font-bold text-driver-800 mt-0.5">#{activeOrder!.id.slice(0,8).toUpperCase()}</p>
              </div>
              <div className="text-right">
                <Badge variant="info" dot>Active</Badge>
                <p className="text-xs text-driver-500 mt-1 capitalize">{status.replace('_', ' ')}</p>
              </div>
            </div>

            <div className="p-4 space-y-4">
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="mt-1 flex flex-col items-center">
                    <div className="w-3 h-3 rounded-full bg-emerald-400 ring-4 ring-emerald-100"/>
                    <div className="w-0.5 flex-1 bg-surface-200 my-1"/>
                    <div className="w-3 h-3 rounded-full bg-red-400"/>
                  </div>
                  <div className="flex-1">
                    <div className="mb-3">
                      <p className="text-2xs font-semibold text-surface-400 uppercase">Pickup</p>
                      <p className="text-sm font-medium text-surface-700">{activeOrder!.restaurant_location}</p>
                    </div>
                    <div>
                      <p className="text-2xs font-semibold text-surface-400 uppercase">Dropoff</p>
                      <p className="text-sm font-medium text-surface-700">{activeOrder!.delivery_location}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="divider"/>

              {canAccept && (
                <Button
                  variant={canAccept.variant}
                  size="lg"
                  className="w-full !rounded-xl"
                  loading={statusMutation.isPending}
                  onClick={() => statusMutation.mutate({
                    id: activeOrder!.id,
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
                <div className="text-center py-2">
                  <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-2">
                    <svg className="w-6 h-6 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  </div>
                  <p className="text-sm font-semibold text-emerald-700">Delivery Complete!</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="h-8"/>
    </div>
  )
}
